import { useCallback, useEffect, useRef, useState } from 'react';
import { config } from '../../domain/config';
import { formatTimer, resolvePhase, timerDisplay } from '../../domain/timer/phase';
import { platform } from '../../platform';
import { useApp } from '../../store';
import { useHold, useNow, useSpaceKey } from '../../ui/hooks';
import { strings } from '../../ui/strings';
import { OvertimeBadge } from '../../ui/components/Badge';
import { Button, HoldButton } from '../../ui/components/Button';
import styles from './FocusScreen.module.css';

/**
 * Immersive: the timer, a calm dimmed island, and nothing else. Controls stay hidden
 * until the pointer moves or the screen is tapped, then fade after 3 seconds.
 */
export function FocusScreen() {
  const phase = useApp((s) => s.phase);
  const soundEnabled = useApp((s) => s.settings.soundEnabled);
  const theme = useApp((s) => s.settings.theme);
  const endFocus = useApp((s) => s.endFocus);
  const abandonFocus = useApp((s) => s.abandonFocus);
  const now = useNow();

  const resolved = resolvePhase(phase, now);
  const display = timerDisplay(resolved, now);
  const overtime = resolved.kind === 'focusOvertime';

  // Keep the screen awake and fullscreen for the whole session (the end alert is scheduled by `bindPhaseEffects`).
  const startedAt = phase.kind === 'focus' ? phase.startedAt : 0;
  const plannedMs = phase.kind === 'focus' ? phase.plannedMs : 0;
  useEffect(() => {
    void platform.wakeLock.request();
    void platform.fullscreen.enter();
    return () => {
      void platform.wakeLock.release();
      void platform.fullscreen.exit();
    };
  }, [startedAt, plannedMs]);

  // One soft chime when the planned time is reached while we are watching.
  const wasOvertime = useRef(overtime);
  useEffect(() => {
    if (overtime && !wasOvertime.current && soundEnabled) {
      const late = resolved.kind === 'focusOvertime' ? now - resolved.startedAt - resolved.plannedMs : 0;
      if (late < config.ui.chimeFreshMs) platform.notify.play('focusEnd');
    }
    wasOvertime.current = overtime;
  }, [overtime, soundEnabled, now, resolved]);

  // Auto-hiding controls.
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const holdApi = useHold(config.ui.holdToAbandonMs, () => void abandonFocus());
  const reveal = useCallback(() => {
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setVisible(false), config.ui.controlsVisibleMs);
  }, []);
  useEffect(() => () => window.clearTimeout(hideTimer.current), []);
  // While holding, controls must not fade out from under the finger.
  useEffect(() => {
    if (holdApi.holding) reveal();
  }, [holdApi.holding, reveal]);

  // Hold Esc to stop (before the planned time), Space to end focus (after it).
  const { start: holdStart, cancel: holdCancel } = holdApi;
  useEffect(() => {
    if (overtime) return;
    const down = (e: KeyboardEvent) => {
      reveal();
      if (e.key === 'Escape' && !e.repeat) holdStart();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Escape') holdCancel();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [overtime, reveal, holdStart, holdCancel]);
  useSpaceKey(overtime ? () => void endFocus() : undefined);

  return (
    <div className={styles.root} onPointerMove={reveal} onPointerDown={reveal}>
      <div className={`${styles.overlay} ${theme === 'dark' ? styles.overlayNight : ''}`} />
      <div className={styles.center}>
        <div className={`${styles.label} type-eyebrow`}>{overtime ? <OvertimeBadge /> : strings.focus.eyebrow}</div>
        <p className={`${styles.timer} type-timer`} role="timer" aria-label={strings.aria.timer}>
          {display ? formatTimer(display) : ''}
        </p>
        <div className={styles.endSlot}>
          {overtime && (
            <Button variant="primaryInverse" onClick={() => void endFocus()}>
              {strings.focus.end}
            </Button>
          )}
        </div>
      </div>
      {!overtime && (
        <div className={`${styles.controls} ${visible ? styles.controlsVisible : ''}`}>
          <HoldButton label={strings.focus.holdToStop} onComplete={() => void abandonFocus()} holdApi={holdApi} />
        </div>
      )}
    </div>
  );
}

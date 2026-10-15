import { useEffect, useRef } from 'react';
import { config } from '../../domain/config';
import { getSpecies } from '../../domain/animals/catalog';
import { formatTimer, resolvePhase, timerDisplay } from '../../domain/timer/phase';
import { platform } from '../../platform';
import { useApp } from '../../store';
import { useNow, usePrefersReducedMotion, useSpaceKey } from '../../ui/hooks';
import { strings } from '../../ui/strings';
import { TierBadge } from '../../ui/components/Badge';
import { Button } from '../../ui/components/Button';
import { FeatureCard, Panel, TierCard } from '../../ui/components/Surfaces';
import { RewardModel } from '../../world/preview/RewardModel';
import layer from '../Screen.module.css';
import styles from './BreakScreen.module.css';

/** Reward reveal, break countdown, and one-tap ways to continue. */
export function BreakScreen() {
  const phase = useApp((s) => s.phase);
  const animals = useApp((s) => s.animals);
  const revealPending = useApp((s) => s.revealPending);
  const soundEnabled = useApp((s) => s.settings.soundEnabled);
  const startFocus = useApp((s) => s.startFocus);
  const goHome = useApp((s) => s.goHome);
  const finishReveal = useApp((s) => s.finishReveal);
  const reducedMotion = usePrefersReducedMotion();
  const now = useNow();

  const resolved = resolvePhase(phase, now);
  const over = resolved.kind === 'breakOver';
  const display = timerDisplay(resolved, now);
  const rewardId = phase.kind === 'break' ? phase.rewardId : undefined;
  const animal = rewardId ? animals.find((a) => a.id === rewardId) : undefined;
  const species = animal ? getSpecies(animal.speciesId) : undefined;

  // Reveal: tier chime once, then the animal joins the island after the reveal time (or on tap).
  const revealId = useRef<string | null>(null);
  useEffect(() => {
    if (!revealPending || !animal || revealId.current === revealPending) return;
    revealId.current = revealPending;
    if (soundEnabled) platform.notify.play(`reveal:${animal.tierRank}`);
    const id = window.setTimeout(finishReveal, config.ui.revealMs);
    return () => window.clearTimeout(id);
  }, [revealPending, animal, soundEnabled, finishReveal]);

  // A lighter chime when the break ends while we are watching.
  const wasOver = useRef(over);
  useEffect(() => {
    if (over && !wasOver.current && soundEnabled && phase.kind === 'break') {
      if (now - phase.startedAt - phase.plannedMs < config.ui.chimeFreshMs) platform.notify.play('breakEnd');
    }
    wasOver.current = over;
  }, [over, soundEnabled, now, phase]);

  const start = () => {
    platform.notify.unlock();
    void startFocus();
  };
  useSpaceKey(start);

  return (
    <div className={layer.layer}>
      <Panel className={styles.panel}>
        {animal && species ? (
          <TierCard
            rank={animal.tierRank}
            elevated
            className={`${styles.card} ${revealPending ? styles.cardSkippable : ''}`}
            onClick={revealPending ? finishReveal : undefined}
            title={revealPending ? strings.aria.revealSkip : undefined}
          >
            <TierBadge rank={animal.tierRank} />
            <RewardModel modelId={species.modelId} reducedMotion={reducedMotion} />
            <p className={`${styles.name} type-display-lg`}>{species.name}</p>
          </TierCard>
        ) : (
          <FeatureCard>
            <p className={`${styles.message} type-body-md`}>{strings.break.noReward}</p>
          </FeatureCard>
        )}

        {over ? (
          <p className={`${styles.ready} type-display-sm`}>{strings.break.ready}</p>
        ) : (
          <>
            <p className={`${styles.label} type-eyebrow`}>{strings.break.eyebrow}</p>
            <p className={`${styles.timer} type-timer-sm`} role="timer" aria-label={strings.aria.timer}>
              {display ? formatTimer(display) : ''}
            </p>
          </>
        )}

        <div className={styles.actions}>
          <Button block onClick={start}>
            {over ? strings.break.startFocus : strings.break.startNow}
          </Button>
          <Button block variant="secondary" onClick={() => void goHome()}>
            {strings.break.home}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

import type { StoredPhase } from './phase';

/**
 * Background timer alerts (guidance_v2 Step 6.3): native builds schedule a local notification for the
 * planned end of Focus and of a break, because the page may be suspended. The only thing allowed to
 * reach the user during Focus. Recomputed on every phase or settings change; scheduling replaces all.
 */
export interface TimerAlert {
  kind: 'focusEnd' | 'breakEnd';
  at: number;
  /** Plays the notification sound (Settings › Sound); silent otherwise. */
  sound: boolean;
}

export function timerAlerts(phase: StoredPhase, now: number, soundEnabled: boolean): TimerAlert[] {
  if (phase.kind === 'idle') return [];
  const at = phase.startedAt + phase.plannedMs;
  if (at <= now) return [];
  return [{ kind: phase.kind === 'focus' ? 'focusEnd' : 'breakEnd', at, sound: soundEnabled }];
}

/**
 * What the lock-screen progress shows (Step 6.8, ADR-049): driven by dates, so the platform renders it
 * while the app is suspended. Focus stays past its end (overtime counts up); a break is gone once over.
 */
export interface LiveState {
  phase: 'focus' | 'break';
  startedAt: number;
  endsAt: number;
}

export function liveStateFor(phase: StoredPhase, enabled: boolean, now: number): LiveState | null {
  if (!enabled || phase.kind === 'idle') return null;
  const endsAt = phase.startedAt + phase.plannedMs;
  if (phase.kind === 'break' && endsAt <= now) return null;
  return { phase: phase.kind, startedAt: phase.startedAt, endsAt };
}

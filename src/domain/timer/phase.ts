import { balance } from '../../../shared/balance/balance';
import { clamp } from '../random';

export type Phase =
  | { kind: 'idle' }
  | { kind: 'focus'; startedAt: number; plannedMs: number; sessionId: string }
  | { kind: 'focusOvertime'; startedAt: number; plannedMs: number; sessionId: string }
  | { kind: 'break'; startedAt: number; plannedMs: number; rewardId?: string; awaiting?: AwaitingReward }
  | { kind: 'breakOver'; rewardId?: string; awaiting?: AwaitingReward };

/**
 * Signed in, a server-verified session ended while the server could not be reached (Step 5.5): the reward
 * is revealed once `end_session` answers; retries reuse the request id.
 */
export interface AwaitingReward {
  sessionId: string;
  requestId: string;
  /** The client's end time; the server clamps it into [start, its now]. */
  endedAt: number;
}

/** The phases that are persisted; overtime and break-over are always derived. */
export type StoredPhase = Extract<Phase, { kind: 'idle' | 'focus' | 'break' }>;

export const IDLE: StoredPhase = { kind: 'idle' };

export const startFocus = (now: number, plannedMs: number, sessionId: string): StoredPhase => ({
  kind: 'focus',
  startedAt: now,
  plannedMs,
  sessionId,
});

export const startBreak = (now: number, plannedMs: number, rewardId?: string): StoredPhase =>
  rewardId === undefined
    ? { kind: 'break', startedAt: now, plannedMs }
    : { kind: 'break', startedAt: now, plannedMs, rewardId };

/** Derives the phase the user should see at `now`. Never accumulates time. */
export function resolvePhase(phase: StoredPhase, now: number): Phase {
  switch (phase.kind) {
    case 'focus':
      return now - phase.startedAt >= phase.plannedMs ? { ...phase, kind: 'focusOvertime' } : phase;
    case 'break':
      if (now - phase.startedAt < phase.plannedMs) return phase;
      return { kind: 'breakOver', ...(phase.rewardId !== undefined && { rewardId: phase.rewardId }), ...(phase.awaiting && { awaiting: phase.awaiting }) };
    default:
      return phase;
  }
}

export interface Countdown {
  /** `down`: remaining time; `up`: overtime since the planned end. */
  direction: 'down' | 'up';
  ms: number;
}

/** What the big timer shows for a resolved phase. `undefined` when no timer applies. */
export function timerDisplay(phase: Phase, now: number): Countdown | undefined {
  switch (phase.kind) {
    case 'focus':
      return { direction: 'down', ms: Math.max(0, phase.plannedMs - (now - phase.startedAt)) };
    case 'focusOvertime':
      return { direction: 'up', ms: Math.max(0, now - phase.startedAt - phase.plannedMs) };
    case 'break':
      return { direction: 'down', ms: Math.max(0, phase.plannedMs - (now - phase.startedAt)) };
    default:
      return undefined;
  }
}

/** `mm:ss`, minutes may exceed 59 (overtime past an hour stays readable). */
export function formatClock(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Countdowns round up (a fresh 25 min timer reads 25:00); overtime rounds down and gets a `+`. */
export function formatTimer(display: Countdown): string {
  if (display.direction === 'up') return `+${formatClock(display.ms)}`;
  return formatClock(Math.ceil(display.ms / 1000) * 1000);
}

/** Planned time plus overtime, capped. `elapsedMs` is `now - startedAt`. */
export function effectiveFocusMs(elapsedMs: number, capMs: number = balance.reward.maxFocusMs): number {
  return clamp(elapsedMs, 0, capMs);
}

export const minutesToMs = (minutes: number): number => Math.round(minutes * 60_000);

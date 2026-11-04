import type { LiveState } from '../../domain/timer/alerts';

/** The lock-screen progress with its words (Step 6.8). */
export interface LiveProgressView extends LiveState {
  /** "Focus" / "Break". */
  title: string;
  /** One quiet line under it (Android), e.g. "Ends at 14:30". */
  detail: string;
  /** Shown once Focus is past its planned end (iOS), "Time's up · open Sift to end focus". */
  overTitle: string;
}

/**
 * iOS Live Activity / Android ongoing notification (guidance_v2 Step 6.8, ADR-049). Passive: no buttons,
 * a tap opens the app. Updated on every phase change; `null` removes it. Web: no-op.
 */
export interface LiveProgressAdapter {
  update(view: LiveProgressView | null): void;
}

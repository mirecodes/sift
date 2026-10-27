import type { TierRank } from '../../domain/config';
import type { TimerAlert } from '../../domain/timer/alerts';

/** Reveal chimes are keyed by tier rank. */
export type Sound = 'focusEnd' | 'breakEnd' | `reveal:${TierRank}`;

/** A timer alert with its words, ready to show as a local notification. */
export interface ScheduledAlert extends TimerAlert {
  title: string;
  body: string;
}

export interface NotifyAdapter {
  /** Call from a user gesture once so audio can play later. */
  unlock(): void;
  /** The synthesized chime, in the foreground. */
  play(sound: Sound): void;
  /**
   * Replaces every scheduled timer notification with `alerts` (Step 6.3; `[]` cancels). Native builds
   * use local notifications because JS is suspended in the background. No-op on web, where the page
   * keeps running and plays the chime itself.
   */
  schedule(alerts: ScheduledAlert[]): void;
}

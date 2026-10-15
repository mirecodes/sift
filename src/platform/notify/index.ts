import type { TierRank } from '../../domain/config';

/** Reveal chimes are keyed by tier rank. */
export type Sound = 'focusEnd' | 'breakEnd' | `reveal:${TierRank}`;

export interface NotifyAdapter {
  /** Call from a user gesture once so audio can play later. */
  unlock(): void;
  play(sound: Sound): void;
  /**
   * Native builds schedule a local notification for the focus end, because JS may be
   * suspended in the background. No-op on web, where the page keeps running.
   */
  scheduleFocusEnd(at: number): void;
  cancelScheduled(): void;
}

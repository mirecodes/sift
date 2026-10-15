import { seededRng } from '../domain/random';
import type { FocusSession, InboxRow } from '../domain/types';

/** Sample data added in memory by `testMode.dummyData` (dev builds only). Never saved or exported. */
export interface DummyData {
  sessions: FocusSession[];
  inbox: InboxRow[];
}

const MIN = 60_000;
const DAYS = 45;

/**
 * Deterministic sample data relative to `now` (ADR-038). Each phase adds its feature's data here
 * (gold in Phase 2, cosmetics in 3, friends in 7, groups in 8, …).
 */
export function createDummyData(now: number): DummyData {
  const rng = seededRng(20261007);
  const sessions: FocusSession[] = [];
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);

  // Stats: about six weeks of sessions, some rest days and some stopped sessions.
  for (let d = DAYS; d >= 0; d--) {
    const day = new Date(midnight);
    day.setDate(day.getDate() - d);
    if (rng() < 0.25) continue;
    const count = 1 + Math.floor(rng() * 5);
    for (let i = 0; i < count; i++) {
      const startedAt = day.getTime() + (8 + i * 2) * 60 * MIN + Math.floor(rng() * 60) * MIN;
      const stopped = rng() < 0.15;
      const minutes = stopped ? 3 + Math.floor(rng() * 15) : 25 + Math.floor(rng() * 45);
      if (startedAt + minutes * MIN > now) continue;
      sessions.push({
        id: `dummy-session-${d}-${i}`,
        startedAt,
        plannedFocusMs: 25 * MIN,
        endedAt: startedAt + minutes * MIN,
        effectiveFocusMs: Math.min(60, minutes) * MIN,
        status: stopped ? 'abandoned' : 'completed',
        togetherRoomId: null,
      });
    }
  }

  // Inbox: notices shown on Home, one at a time.
  const inbox: InboxRow[] = [
    { id: 'dummy-notice-1', createdAt: now - 2 * MIN, notice: { kind: 'animals_departed', animalIds: ['dummy-a', 'dummy-b', 'dummy-c'], gold: 12 } },
    { id: 'dummy-notice-2', createdAt: now - MIN, notice: { kind: 'friend_request', userId: 'dummy-user' } },
  ];

  return { sessions, inbox };
}

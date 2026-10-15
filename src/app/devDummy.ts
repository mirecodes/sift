import { seededRng } from '../domain/random';
import { balance } from '../../shared/balance/balance';
import { CATALOG, type AnimalSpecies } from '../domain/animals/catalog';
import type { FocusSession, InboxRow, LedgerEntry } from '../domain/types';

/** Sample data added in memory by `testMode.dummyData` (dev builds only). Never saved or exported. */
export interface DummyData {
  sessions: FocusSession[];
  inbox: InboxRow[];
  ledger: LedgerEntry[];
  animals: { species: AnimalSpecies; acquiredAt: number }[];
}

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const DAYS = 45;
/** Gold credits, oldest first: 140 gold in all. */
const DUMMY_GOLD = [30, 9, 25, 14, 3, 8, 26, 25];
const LIFETIME = balance.economy.animalLifetimeDays * DAY;
/** [species, age]. */
const DUMMY_ANIMALS: [string, number][] = [
  ['chick', 8 * DAY],
  ['duck', 9 * DAY],
  ['sheep', 10 * DAY],
  ['fox', 8.5 * DAY],
  ['tiger', 12 * DAY],
  ['rabbit', LIFETIME - 1.5 * MIN],
  ['hamster', LIFETIME - 2.5 * MIN],
  ['dog', 6 * DAY],
  ['cat', 4 * DAY],
  ['panda', 1 * DAY],
  ['unicorn', 20 * DAY],
];

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

  // Gold: past departures (shows the HUD counter and a mid-size coin pile). Spending it in a dev
  // build writes a real debit, so the stored balance can go below zero there.
  const ledger: LedgerEntry[] = DUMMY_GOLD.map((amount, i) => ({
    id: `dummy-gold-${i}`,
    at: now - (DUMMY_GOLD.length - i) * DAY,
    currency: 'gold',
    amount,
    reason: 'expiry',
    refId: null,
  }));

  // Inbox: notices shown on Home, one at a time. Departure notices come from the animals below.
  const inbox: InboxRow[] = [{ id: 'dummy-notice-1', createdAt: now - MIN, notice: { kind: 'friend_request', userId: 'dummy-user' } }];

  // Animals by age. With `features.economy` on, the expired ones leave at startup (one notice),
  // two more leave a minute or two later, and the rest show their time left when poked.
  const species = (id: string) => CATALOG.find((s) => s.id === id)!;
  const animals = DUMMY_ANIMALS.map(([id, age]) => ({ species: species(id), acquiredAt: now - age }));

  return { sessions, inbox, ledger, animals };
}

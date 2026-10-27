import type { IslandState, ProfileView, SyncDelta, SyncRows } from '../../shared/api/types';
import { balance } from '../../shared/balance/balance';
import { computeExpirations } from '../../shared/rules/expiry';
import type { InboxRow, PlacedAnimal } from '../../shared/types/rows';
import { DEFAULT_BLOCK_THEME } from '../../src/domain/config';
import { DEFAULT_EQUIPPED, sanitizeEquipped } from '../../src/domain/cosmetics/inventory';
import { goldBalance, LEDGER_REASON } from '../../src/domain/economy/ledger';
import type { Tx } from './db';
import type { HandlerCtx, UserWriter } from './context';
import type { ProfileRow, Rows } from './schema';

export async function ensureProfile(tx: Tx, userId: string, now: number): Promise<ProfileRow> {
  const found = await tx.table('profiles').get(userId);
  if (found) return found;
  const profile: ProfileRow = { userId, handleName: null, handleKey: null, handleTag: null, nameChangedAt: null, avatarSpeciesId: null, showPresence: true, seq: 0, createdAt: now };
  await tx.table('profiles').insert(profile);
  return profile;
}

export const profileView = (p: ProfileRow): ProfileView => ({
  userId: p.userId,
  handle: p.handleName && p.handleTag ? { name: p.handleName, tag: p.handleTag } : null,
  avatarSpeciesId: p.avatarSpeciesId,
  showPresence: p.showPresence,
  nameChangedAt: p.nameChangedAt,
});

/** An account has data once it has an island (created by the first focus or the first-sign-in upload). */
export const hasIsland = async (tx: Tx, userId: string): Promise<boolean> => (await tx.table('island_state').get(userId)) !== undefined;

/** The island of an account, created on first use with a new seed and the starter gold (§9 Q12). */
export async function ensureIsland(c: HandlerCtx): Promise<IslandState> {
  const found = await c.tx.table('island_state').get(c.userId);
  if (found) return found;
  const island = await c.w.put('island_state', { seed: Math.floor(c.env.random() * 2 ** 31), blockThemeId: DEFAULT_BLOCK_THEME });
  await c.w.put('ledger', { id: c.env.uuid(), at: c.now, currency: 'gold', amount: balance.economy.starterGold, reason: LEDGER_REASON.starter, refId: null });
  return island;
}

const strip = <T extends { userId: string; updatedSeq: number }>(row: T): Omit<T, 'userId' | 'updatedSeq'> => {
  const { userId: _u, updatedSeq: _s, ...rest } = row;
  return rest;
};

/** One user's state as the rules need it. */
export async function userState(tx: Tx, userId: string) {
  const [animals, ledger, cosmetics, buildings, equipped, island] = await Promise.all([
    tx.table('animals').find({ userId }),
    tx.table('ledger').find({ userId }),
    tx.table('cosmetics_owned').find({ userId }),
    tx.table('placed_buildings').find({ userId }),
    tx.table('equipped').get(userId),
    tx.table('island_state').get(userId),
  ]);
  const owned = cosmetics.map(strip);
  return {
    animals: animals.map(strip).sort((a, b) => a.acquiredAt - b.acquiredAt || a.id.localeCompare(b.id)),
    gold: goldBalance(ledger),
    cosmetics: owned,
    buildings: buildings.filter((b) => !b.deleted).map(strip).sort((a, b) => a.placedAt - b.placedAt),
    equipped: equipped ? sanitizeEquipped(strip(equipped), owned) : DEFAULT_EQUIPPED,
    island,
  };
}

/**
 * Departs every expired active animal (Step 2.2 on the server, Step 5.5): status, one gold credit per
 * verified animal (unverified ones leave none, ADR-047) and one `animals_departed` notice, all with the
 * caller's sequence number. Lazy: runs at the start of every call that reads or spends gold.
 */
export async function settleExpirations(c: { tx: Tx; now: number; env: { uuid(): string } }, w: UserWriter): Promise<void> {
  const animals = (await c.tx.table('animals').find({ userId: w.userId, status: 'active' })) as Rows['animals'][];
  const due = computeExpirations(animals, c.now, balance.economy);
  if (!due.length) return;
  const byId = new Map(animals.map((a) => [a.id, a]));
  let gold = 0;
  for (const d of due) {
    const a = byId.get(d.animalId)!;
    await w.put('animals', { ...strip(a), status: 'departed', endedAt: d.expiredAt, endReason: 'expired' } satisfies PlacedAnimal);
    if (a.verified && d.gold > 0) {
      gold += d.gold;
      await w.put('ledger', { id: c.env.uuid(), at: d.expiredAt, currency: 'gold', amount: d.gold, reason: LEDGER_REASON.expiry, refId: a.id });
    }
  }
  await notify(w, c.env.uuid(), c.now, { kind: 'animals_departed', animalIds: due.map((d) => d.animalId), gold });
}

/** Queues a notice for a user (shown on Home or Break, never during Focus). */
export async function notify(w: UserWriter, id: string, now: number, notice: InboxRow['notice']): Promise<void> {
  await w.put('notices', { id, createdAt: now, notice });
}

/** Rows of one user changed after `since` (delta sync). Dismissed notices go out once, so other devices drop them. */
export async function pull(tx: Tx, userId: string, since: number): Promise<SyncDelta> {
  const profile = await tx.table('profiles').get(userId);
  const [animals, ledger, cosmetics, placedBuildings, sessions, islandHistory, notices, equipped, island] = await Promise.all([
    tx.table('animals').since(userId, since),
    tx.table('ledger').since(userId, since),
    tx.table('cosmetics_owned').since(userId, since),
    tx.table('placed_buildings').since(userId, since),
    tx.table('sessions').since(userId, since),
    tx.table('island_history').since(userId, since),
    tx.table('notices').since(userId, since),
    tx.table('equipped').since(userId, since),
    tx.table('island_state').since(userId, since),
  ]);
  const rows: SyncRows = {
    animals: animals.map(strip),
    ledger: ledger.map(strip),
    cosmetics: cosmetics.map(strip),
    placedBuildings: placedBuildings.map(strip),
    sessions: sessions.map(strip),
    islandHistory: islandHistory.map(strip),
    // A first full sync skips notices already dismissed elsewhere.
    notices: notices.filter((n) => since > 0 || !n.dismissed).map(strip),
  };
  if (equipped[0]) rows.equipped = strip(equipped[0]);
  if (island[0]) rows.island = strip(island[0]);
  return { seq: profile?.seq ?? 0, rows };
}

export { strip };

import type { LocalSave, SyncDelta, SyncRows } from '../../shared/api/types';
import type { BackupData } from '../domain/backup';
import { DEFAULT_BLOCK_THEME } from '../domain/config';
import type { Equipped, FocusSession, InboxRow, IslandHistoryEntry, LedgerEntry, OwnedCosmetic, PlacedAnimal, PlacedBuilding, WorldState } from '../domain/types';
import type { AccountLink, Commit } from '../platform/storage';

/** The rows the store keeps that a delta can change. */
export interface SyncedState {
  world: WorldState;
  animals: PlacedAnimal[];
  sessions: FocusSession[];
  cosmetics: OwnedCosmetic[];
  equipped: Equipped;
  placedBuildings: PlacedBuilding[];
  islandHistory: IslandHistoryEntry[];
  inbox: InboxRow[];
  gold: number;
}

/** Replaces rows by id and appends new ones, keeping order otherwise. */
export function mergeById<T extends { id: string }>(list: readonly T[], rows: readonly T[]): T[] {
  if (!rows.length) return [...list];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out = list.map((x) => byId.get(x.id) ?? x);
  const seen = new Set(list.map((x) => x.id));
  for (const r of rows) if (!seen.has(r.id)) out.push(r);
  return out;
}

/**
 * Applies a delta from the server (Step 5.6) to the local cache: the write for storage and the next
 * store state. Ledger rows are immutable (a known id is skipped); dismissed notices leave the inbox;
 * notices already shown here are not queued again.
 */
export function applyDelta(state: SyncedState, delta: SyncDelta, known: { ledger: ReadonlySet<string>; dismissed: ReadonlySet<string> }, link: AccountLink) {
  const r = delta.rows;
  const freshLedger = r.ledger.filter((e) => !known.ledger.has(e.id));
  const inboxIds = new Set(state.inbox.map((n) => n.id));
  const removeNotices = r.notices.filter((n) => n.dismissed && inboxIds.has(n.id)).map((n) => n.id);
  const addNotices: InboxRow[] = r.notices
    .filter((n) => !n.dismissed && !inboxIds.has(n.id) && !known.dismissed.has(n.id))
    .map((n) => ({ id: n.id, createdAt: n.createdAt, notice: n.notice }));
  const removeBuildings = r.placedBuildings.filter((b) => b.deleted).map((b) => b.id);
  const putBuildings = r.placedBuildings.filter((b) => !b.deleted).map(({ deleted: _d, ...b }) => b);
  const world = r.island ? { seed: r.island.seed, blockThemeId: r.island.blockThemeId } : undefined;
  const nextLink: AccountLink = { ...link, seq: Math.max(link.seq, delta.seq) };

  const commit: Commit = {
    ...(r.animals.length && { animals: r.animals }),
    ...(r.sessions.length && { sessions: r.sessions }),
    ...(freshLedger.length && { ledgerSync: freshLedger }),
    ...(r.cosmetics.length && { cosmeticsAdd: r.cosmetics }),
    ...(putBuildings.length && { buildingsPut: putBuildings }),
    ...(removeBuildings.length && { buildingsRemove: removeBuildings }),
    ...(r.islandHistory.length && { islandHistoryAdd: r.islandHistory }),
    ...(addNotices.length && { inboxAdd: addNotices }),
    ...(removeNotices.length && { inboxRemove: removeNotices }),
    ...(r.equipped && { equipped: r.equipped }),
    ...(world && { world }),
    account: nextLink,
  };
  const next: SyncedState = {
    world: world ?? state.world,
    animals: mergeById(state.animals, r.animals),
    sessions: mergeById(state.sessions, r.sessions),
    cosmetics: mergeById(state.cosmetics, r.cosmetics),
    equipped: r.equipped ?? state.equipped,
    placedBuildings: mergeById(state.placedBuildings, putBuildings).filter((b) => !removeBuildings.includes(b.id)),
    islandHistory: mergeById(state.islandHistory, r.islandHistory),
    inbox: [...state.inbox.filter((n) => !removeNotices.includes(n.id)), ...addNotices],
    gold: state.gold + freshLedger.reduce((s, e) => s + e.amount, 0),
  };
  return { commit, next, link: nextLink, ledgerIds: freshLedger.map((e) => e.id), championWeek: r.island?.championWeek };
}

/**
 * The local stores rebuilt from a full server pull (sign-in on a device, "use the data from your
 * account"): device settings and downloaded content packs stay; everything else is the account's.
 */
export function backupFromRows(rows: SyncRows, keep: { kv: unknown[]; contentPacks: unknown[] }, link: AccountLink): BackupData {
  const kv = keep.kv.filter((r) => (r as { key: string }).key === 'settings');
  const world: WorldState = rows.island ? { seed: rows.island.seed, blockThemeId: rows.island.blockThemeId } : { seed: 1, blockThemeId: DEFAULT_BLOCK_THEME };
  kv.push({ key: 'world', value: world }, { key: 'account', value: link });
  if (rows.equipped) kv.push({ key: 'equipped', value: rows.equipped });
  return {
    kv,
    sessions: rows.sessions,
    animals: rows.animals,
    ledger: rows.ledger,
    cosmetics: rows.cosmetics,
    placedBuildings: rows.placedBuildings.filter((b) => !b.deleted).map(({ deleted: _d, ...b }) => b),
    islandHistory: rows.islandHistory,
    inbox: rows.notices.filter((n) => !n.dismissed).map((n) => ({ id: n.id, createdAt: n.createdAt, notice: n.notice })),
    contentPacks: keep.contentPacks,
  };
}

/** This device's save for the first sign-in upload (Step 5.7). Memory-only rows (test mode, dummy data) stay out. */
export function localSaveOf(state: SyncedState, ledger: readonly LedgerEntry[], memoryOnly: ReadonlySet<string>): LocalSave {
  const real = <T extends { id: string }>(list: readonly T[]) => list.filter((x) => !memoryOnly.has(x.id));
  return {
    world: state.world,
    animals: real(state.animals),
    sessions: state.sessions.filter((s) => !s.id.startsWith('dummy-')),
    ledger: ledger.filter((e) => !e.id.startsWith('dummy-')),
    cosmetics: real(state.cosmetics).filter((c) => !c.id.startsWith('dummy-')),
    equipped: state.equipped,
    placedBuildings: real(state.placedBuildings),
    islandHistory: state.islandHistory,
  };
}

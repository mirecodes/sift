import Dexie, { type EntityTable } from 'dexie';
import type {
  ContentPackRow,
  FocusSession,
  InboxRow,
  IslandHistoryEntry,
  LedgerEntry,
  OwnedCosmetic,
  PlacedAnimal,
  PlacedBuilding,
} from '../domain/types';
import { v4 } from './migrations';

export interface KvRow {
  key: 'settings' | 'world' | 'phase' | 'equipped';
  value: unknown;
}

/**
 * Schema versions:
 *  1: kv (settings, world, active phase), sessions, animals.
 *  2: the Legendary and Mythic tier names were swapped (ADR-026); stored animals are renamed.
 *  3: the Epic and Mythic tier names were swapped (ADR-027); stored animals are renamed.
 *  4: guidance_v2 §4.1. Animal lifecycle fields, session `togetherRoomId`, world `blockThemeId`,
 *     new settings; new stores ledger, cosmetics, placedBuildings, islandHistory, inbox, contentPacks
 *     (`equipped` is a kv singleton). Row upgrades live in `migrations.ts` (shared with backups).
 * Add a new `db.version(n).stores(...)` with an `upgrade` for every change; never edit old versions.
 */
export class SiftDB extends Dexie {
  kv!: EntityTable<KvRow, 'key'>;
  sessions!: EntityTable<FocusSession, 'id'>;
  animals!: EntityTable<PlacedAnimal, 'id'>;
  ledger!: EntityTable<LedgerEntry, 'id'>;
  cosmetics!: EntityTable<OwnedCosmetic, 'id'>;
  placedBuildings!: EntityTable<PlacedBuilding, 'id'>;
  islandHistory!: EntityTable<IslandHistoryEntry, 'id'>;
  inbox!: EntityTable<InboxRow, 'id'>;
  contentPacks!: EntityTable<ContentPackRow, 'contentVersion'>;

  constructor(name = 'sift') {
    super(name);
    this.version(1).stores({
      kv: 'key',
      sessions: 'id, startedAt',
      animals: 'id, acquiredAt',
    });
    this.version(2)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('animals')
          .toCollection()
          .modify((a: { tier: string }) => {
            // Version 1 stored the top tier as 'mythic' and the one below as 'legendary'.
            if (a.tier === 'legendary') a.tier = 'mythic';
            else if (a.tier === 'mythic') a.tier = 'legendary';
          }),
      );
    this.version(3)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('animals')
          .toCollection()
          .modify((a: { tier: string }) => {
            // Version 2 called the second tier 'epic' and the third 'mythic' (ADR-027 swaps them back in rank).
            if (a.tier === 'epic') a.tier = 'mythic';
            else if (a.tier === 'mythic') a.tier = 'epic';
          }),
      );
    this.version(4)
      .stores({
        animals: 'id, acquiredAt, status',
        ledger: 'id, at, refId',
        cosmetics: 'id, kind',
        placedBuildings: 'id',
        islandHistory: 'id',
        inbox: 'id, createdAt',
        contentPacks: 'contentVersion',
      })
      .upgrade(async (tx) => {
        const upgrade = (row: object, fn: (r: Record<string, unknown>) => Record<string, unknown>) =>
          Object.assign(row, fn(row as Record<string, unknown>));
        await tx.table('animals').toCollection().modify((a) => void upgrade(a, v4.animal));
        await tx.table('sessions').toCollection().modify((s) => void upgrade(s, v4.session));
        await tx.table('kv').toCollection().modify((r) => void upgrade(r, v4.kv));
      });
  }
}

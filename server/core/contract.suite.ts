import { describe, expect, it } from 'vitest';
import type { LocalSave } from '../../shared/api/types';
import { API_VERSION } from '../../shared/api/types';
import { getSpecies } from '../../src/domain/animals/catalog';
import { newPlacedAnimal } from '../../src/domain/animals/placed';
import { getOccupancy, isStandable, tileKey } from '../../src/domain/island/occupancy';
import { islandTiles, islandSide } from '../../src/domain/island/island';
import { clearConfigCache, handle, runHourlyJob } from './api';
import type { ServerDb } from './db';
import { IMPORTED_GOLD_CAP } from './handlers/core';
import { MIN, testServer } from './testing';

const DAY = 24 * 60 * MIN;

/** A local save with a few animals on valid tiles (one Unicorn), some gold and an owned fence. */
export function sampleSave(seed = 42, now = Date.UTC(2026, 9, 26)): LocalSave {
  const tiles = islandTiles(seed, islandSide(4)).filter((t) => !t.water && Math.hypot(t.x, t.z) > 2);
  const animals = ['unicorn', 'fox', 'chick'].map((s, i) => newPlacedAnimal(`save-a${i}`, getSpecies(s), tiles[i]!, now - i * MIN, `save-s${i}`));
  return {
    world: { seed, blockThemeId: 'default' },
    animals,
    sessions: animals.map((a, i) => ({ id: `save-s${i}`, startedAt: a.acquiredAt - 30 * MIN, plannedFocusMs: 25 * MIN, endedAt: a.acquiredAt, effectiveFocusMs: 30 * MIN, status: 'completed' as const, rewardAnimalId: a.id, togetherRoomId: null })),
    ledger: [{ id: 'save-l1', at: now, currency: 'gold', amount: 120, reason: 'starter', refId: null }],
    cosmetics: [
      { id: 'save-c1', kind: 'building', defId: 'fence', acquiredAt: now, source: 'shop' },
      { id: 'save-c2', kind: 'building', defId: 'no-such-thing', acquiredAt: now, source: 'shop' },
    ],
    placedBuildings: [],
    islandHistory: [],
  };
}

/**
 * The API contract (Step 5.2, 5.5–5.8), run against every server database adapter: memory here,
 * Postgres (PGlite) in `server/pg/pg.test.ts`.
 */
export function describeContract(name: string, makeDb: () => Promise<ServerDb> | ServerDb) {
  const server = async (seed?: number) => testServer({ db: await makeDb(), ...(seed !== undefined && { seed }) });

  describe(`API contract (${name})`, () => {
    it('gates old clients, requires auth and validates arguments', async () => {
      const s = await server();
      expect(await s.call('a', 'me', {}, { apiVersion: API_VERSION - 1 })).toMatchObject({ ok: false, error: { code: 'client_outdated' } });
      expect(await s.call(null, 'me', {})).toMatchObject({ ok: false, error: { code: 'unauthorized' } });
      expect(await s.call(null, 'get_content_manifest', { clientVersion: '0.2.0' })).toMatchObject({ ok: true, data: { manifest: null } });
      expect(await s.call('a', 'start_session', { plannedMs: 'x' } as never)).toMatchObject({ ok: false, error: { code: 'invalid' } });
      const noId = await handle(s.env, { userId: 'a', platform: 'web', appVersion: '0.2.0', apiVersion: API_VERSION }, { op: 'purchase', args: { defId: 'fence' } });
      expect(noId).toMatchObject({ ok: false, error: { code: 'invalid' } });
      const r = await s.call('a', 'me', {});
      expect(r).toMatchObject({ ok: true, data: { hasData: false, profile: { userId: 'a', handle: null } }, serverNow: s.clock.t });
    });

    it('runs a focus session on the server and rewards it once (idempotent retries)', async () => {
      const s = await server();
      const { session } = await s.ok('a', 'start_session', { plannedMs: 25 * MIN });
      expect(session).toMatchObject({ status: 'running', startedAt: s.clock.t, verified: true });
      expect(await s.call('a', 'start_session', { plannedMs: 25 * MIN })).toMatchObject({ ok: false, error: { code: 'session_already_running' } });
      s.clock.t += 31 * MIN;
      // The client's clock is ahead: the end is clamped to the server's now.
      const end = await s.call('a', 'end_session', { sessionId: session.id, endedAt: s.clock.t + 10 * MIN, status: 'completed' }, { requestId: 'end-1', sinceSeq: 0 });
      if (!end.ok) throw new Error(end.error.code);
      expect(end.data.session).toMatchObject({ status: 'completed', endedAt: s.clock.t, effectiveFocusMs: 31 * MIN });
      const animal = end.data.animal!;
      expect(animal).toMatchObject({ status: 'active', verified: true, sessionId: session.id });
      expect(end.delta!.rows.animals.map((a) => a.id)).toEqual([animal.id]);
      expect(end.delta!.rows.ledger).toMatchObject([{ amount: 30, reason: 'starter' }]);
      const island = end.delta!.rows.island!;
      const info = getOccupancy({ seed: island.seed, islandLevel: 1, animals: [], buildings: [] }).get(tileKey({ x: animal.tileX, z: animal.tileZ }));
      expect(info && isStandable(info)).toBe(true);
      const again = await s.call('a', 'end_session', { sessionId: session.id, endedAt: s.clock.t, status: 'completed' }, { requestId: 'end-1' });
      expect(again.ok && again.data.animal?.id).toBe(animal.id);
      const pulled = await s.call('a', 'sync_pull', {}, { sinceSeq: 0 });
      expect(pulled.ok && pulled.delta!.rows.animals).toHaveLength(1);
    });

    it('starts over a stale or forced running session, and no reward under 25 minutes', async () => {
      const s = await server();
      const first = await s.ok('a', 'start_session', { plannedMs: 25 * MIN });
      const second = await s.ok('a', 'start_session', { plannedMs: 25 * MIN, force: true });
      expect(second.session.id).not.toBe(first.session.id);
      s.clock.t += 10 * MIN;
      const end = await s.ok('a', 'end_session', { sessionId: second.session.id, endedAt: s.clock.t, status: 'completed' });
      expect(end.animal).toBeNull();
      const stopped = await s.ok('a', 'start_session', { plannedMs: 25 * MIN });
      s.clock.t += 5 * 3_600_000;
      expect((await s.ok('a', 'start_session', { plannedMs: 25 * MIN })).session.id).not.toBe(stopped.session.id);
    });

    it('delta sync returns only what changed after the cursor', async () => {
      const s = await server();
      const a = await s.call('a', 'sync_pull', {}, { sinceSeq: 0 });
      if (!a.ok) throw new Error();
      const seq = a.delta!.seq;
      const b = await s.call('a', 'sync_pull', {}, { sinceSeq: seq });
      expect(b.ok && b.delta).toMatchObject({ seq, rows: { animals: [], ledger: [], sessions: [] } });
      await s.ok('a', 'start_session', { plannedMs: 25 * MIN });
      const c = await s.call('a', 'sync_pull', {}, { sinceSeq: seq });
      expect(c.ok && c.delta!.rows.sessions).toHaveLength(1);
      expect(c.ok && c.delta!.seq).toBeGreaterThan(seq);
    });

    it('takes a first-sign-in save once, replaces only on request, caps the gold', async () => {
      const s = await server();
      await s.ok('a', 'upload_local_save', { save: sampleSave(), replace: false });
      expect((await s.ok('a', 'me', {})).hasData).toBe(true);
      expect(await s.call('a', 'upload_local_save', { save: sampleSave(), replace: false })).toMatchObject({ ok: false, error: { code: 'account_not_empty' } });
      const pulled = await s.call('a', 'sync_pull', {}, { sinceSeq: 0 });
      if (!pulled.ok) throw new Error();
      expect(pulled.delta!.rows.animals.every((a) => a.verified)).toBe(true);
      expect(pulled.delta!.rows.cosmetics.map((c) => c.defId)).toEqual(['fence']); // unknown items dropped
      expect(pulled.delta!.rows.island).toMatchObject({ seed: 42 });
      const rich = { ...sampleSave(), ledger: [{ id: 'x', at: 0, currency: 'gold' as const, amount: 99_999, reason: 'starter', refId: null }] };
      await s.ok('a', 'upload_local_save', { save: rich, replace: true });
      const after = await s.call('a', 'sync_pull', {}, { sinceSeq: 0 });
      expect(after.ok && after.delta!.rows.ledger.reduce((t, e) => t + e.amount, 0)).toBe(IMPORTED_GOLD_CAP);
    });

    it('sells items for gold in one transaction, once per request id', async () => {
      const s = await server();
      await s.ok('a', 'upload_local_save', { save: sampleSave(), replace: false });
      expect(await s.call('a', 'purchase', { defId: 'golden:tiger' })).toMatchObject({ ok: false, error: { code: 'species_not_found' } });
      expect(await s.call('a', 'purchase', { defId: 'champion-flag' })).toMatchObject({ ok: false, error: { code: 'item_unavailable' } });
      expect(await s.call('a', 'purchase', { defId: 'golden:fox' })).toMatchObject({ ok: true, data: { item: { defId: 'golden:fox', kind: 'animalSkin' } } });
      expect(await s.call('a', 'purchase', { defId: 'golden:fox' })).toMatchObject({ ok: false, error: { code: 'already_owned' } });
    });

    it('refuses a purchase the balance does not cover, and never charges twice', async () => {
      const s = await server();
      const save = { ...sampleSave(), ledger: [{ id: 'g', at: 0, currency: 'gold' as const, amount: 40, reason: 'starter', refId: null }] };
      await s.ok('a', 'upload_local_save', { save, replace: false });
      expect(await s.call('a', 'purchase', { defId: 'autumn' })).toMatchObject({ ok: false, error: { code: 'insufficient_gold' } });
      await s.ok('a', 'purchase', { defId: 'lantern' }, { requestId: 'buy-1' });
      await s.ok('a', 'purchase', { defId: 'lantern' }, { requestId: 'buy-1' });
      const r = await s.call('a', 'sync_pull', {}, { sinceSeq: 0 });
      if (!r.ok) throw new Error();
      expect(r.delta!.rows.cosmetics.filter((c) => c.defId === 'lantern')).toHaveLength(1);
      expect(r.delta!.rows.ledger.reduce((t, e) => t + e.amount, 0)).toBe(40 - 25);
      expect(await s.call('a', 'purchase', { defId: 'golden:fox' })).toMatchObject({ ok: false, error: { code: 'insufficient_gold' } });
    });

    it('settles expirations lazily: gold for verified animals, none for unverified, one notice', async () => {
      const s = await server();
      await s.ok('a', 'upload_local_save', { save: sampleSave(42, s.clock.t), replace: false });
      // An offline-started session uploads an unverified animal.
      const start = s.clock.t + MIN;
      s.clock.t += 40 * MIN;
      const offline = newPlacedAnimal('off-1', getSpecies('cow'), { x: 1, z: 1 }, start + 30 * MIN, 'off-s');
      await s.ok('a', 'sync_push', { ops: [{ kind: 'local_session', session: { id: 'off-s', startedAt: start, plannedFocusMs: 25 * MIN, endedAt: start + 30 * MIN, effectiveFocusMs: 30 * MIN, status: 'completed', rewardAnimalId: 'off-1', togetherRoomId: null }, animal: offline }] });
      s.clock.t += 8 * DAY;
      const r = await s.call('a', 'sync_pull', {}, { sinceSeq: 0 });
      if (!r.ok) throw new Error();
      const departed = r.delta!.rows.animals.filter((a) => a.status === 'departed');
      expect(departed.map((a) => a.speciesId).sort()).toEqual(['chick', 'cow', 'fox']); // the Unicorn stays
      expect(r.delta!.rows.animals.find((a) => a.id === 'off-1')).toMatchObject({ verified: false });
      const credits = r.delta!.rows.ledger.filter((e) => e.reason === 'expiry');
      expect(credits.map((e) => e.amount).sort()).toEqual([1, 8]); // chick + fox; the unverified cow leaves nothing
      expect(r.delta!.rows.notices).toMatchObject([{ notice: { kind: 'animals_departed', gold: 9 } }]);
      const twice = await s.call('a', 'sync_pull', {}, { sinceSeq: r.delta!.seq });
      expect(twice.ok && twice.delta!.rows.ledger).toEqual([]);
    });

    it('validates the building layout and removes buildings as tombstones', async () => {
      const s = await server();
      await s.ok('a', 'upload_local_save', { save: sampleSave(), replace: false });
      const tile = islandTiles(42, islandSide(3)).find((t) => !t.water && Math.hypot(t.x, t.z) >= 2 && Math.hypot(t.x, t.z) < 3)!;
      const fence = { id: 'b1', defId: 'fence', tileX: tile.x, tileZ: tile.z, rotation: 0 as const, placedAt: s.clock.t };
      await s.ok('a', 'apply_layout', { buildings: [fence] });
      expect(await s.call('a', 'apply_layout', { buildings: [fence, { ...fence, id: 'b2', tileX: tile.x + 1 }] })).toMatchObject({ ok: false, error: { code: 'layout_invalid' } });
      expect(await s.call('a', 'apply_layout', { buildings: [{ ...fence, tileX: 0, tileZ: 0 }] })).toMatchObject({ ok: false, error: { code: 'layout_invalid' } });
      const before = await s.call('a', 'sync_pull', {}, { sinceSeq: 0 });
      await s.ok('a', 'apply_layout', { buildings: [] });
      const after = await s.call('a', 'sync_pull', {}, { sinceSeq: before.ok ? before.delta!.seq : 0 });
      expect(after.ok && after.delta!.rows.placedBuildings).toMatchObject([{ id: 'b1', deleted: true }]);
    });

    it('moves the island with a Unicorn on the server', async () => {
      const s = await server();
      expect(await s.call('a', 'move_island', { seed: 9 })).toMatchObject({ ok: false, error: { code: 'no_unicorn' } });
      const t = await server();
      await t.ok('b', 'upload_local_save', { save: sampleSave(), replace: false });
      const r = await t.call('b', 'move_island', { seed: 9 }, { sinceSeq: 0 });
      if (!r.ok) throw new Error(r.error.code);
      expect(r.delta!.rows.island).toMatchObject({ seed: 9 });
      expect(r.delta!.rows.animals.find((a) => a.speciesId === 'unicorn')).toMatchObject({ status: 'spent', endReason: 'island_move' });
      expect(r.delta!.rows.islandHistory).toMatchObject([{ seed: 42 }]);
    });

    it('pushes equip and notice dismissals through the outbox', async () => {
      const s = await server();
      await s.ok('a', 'upload_local_save', { save: sampleSave(), replace: false });
      await s.ok('a', 'sync_push', { ops: [{ kind: 'equip', equipped: { skinsBySpecies: { fox: ['golden:fox'] }, blockThemeId: 'snow' } }] });
      const r = await s.call('a', 'sync_pull', {}, { sinceSeq: 0 });
      // Not owned: dropped back to the defaults.
      expect(r.ok && r.delta!.rows.equipped).toEqual({ skinsBySpecies: {}, blockThemeId: 'default' });
    });

    it('rate-limits per user and operation', async () => {
      const s = await server();
      await s.env.db.transaction((tx) => tx.table('app_config').put({ key: 'client', value: { rateLimits: { default: 2 } } }));
      clearConfigCache(s.env);
      await s.ok('a', 'me', {});
      await s.ok('a', 'me', {});
      expect(await s.call('a', 'me', {})).toMatchObject({ ok: false, error: { code: 'rate_limited' } });
      expect(await s.call('b', 'me', {})).toMatchObject({ ok: true });
    });

    it('exports and deletes an account', async () => {
      const s = await server();
      const deleted: string[] = [];
      s.env.hooks = { deleteAuthUser: async (id) => void deleted.push(id) };
      await s.ok('a', 'upload_local_save', { save: sampleSave(), replace: false });
      const exported = await s.ok('a', 'export_account', {});
      expect(exported.rows.animals).toHaveLength(3);
      await s.ok('a', 'delete_account', {});
      expect(deleted).toEqual(['a']);
      expect((await s.ok('a', 'me', {})).hasData).toBe(false);
    });

    it('settles everyone hourly and drops old request results', async () => {
      const s = await server();
      await s.ok('a', 'upload_local_save', { save: sampleSave(42, s.clock.t), replace: false });
      s.clock.t += 3 * DAY + 8 * DAY;
      expect(await runHourlyJob(s.env)).toEqual({ users: 1 });
      const left = await s.env.db.transaction((tx) => tx.table('api_requests').find({}));
      expect(left).toEqual([]);
      const r = await s.call('a', 'sync_pull', {}, { sinceSeq: 0 });
      expect(r.ok && r.delta!.rows.notices).toHaveLength(1);
    });
  });
}

import type { OpArgs, OpResult, Op } from '../../../shared/api/types';
import { balance } from '../../../shared/balance/balance';
import { compareVersions } from '../../../shared/content/pack';
import type { FocusSession, PlacedAnimal, PlacedBuilding } from '../../../shared/types/rows';
import { getSpecies } from '../../../src/domain/animals/catalog';
import { isActive, newPlacedAnimal } from '../../../src/domain/animals/placed';
import { placementProblem } from '../../../src/domain/build/placement';
import { content } from '../../../src/domain/content';
import { buyProblem, chosenSkins, grantFor, ownedCount, pickSpawnSkin, sanitizeEquipped } from '../../../src/domain/cosmetics/inventory';
import { LEDGER_REASON } from '../../../src/domain/economy/ledger';
import { islandLevel, pickNewAnimalTile } from '../../../src/domain/island/level';
import { moveIsland } from '../../../src/domain/island/move';
import { getOccupancy, isStandable, repairPlacements, tileKey, animalTile } from '../../../src/domain/island/occupancy';
import { rollReward } from '../../../src/domain/reward/reward';
import { effectiveFocusMs } from '../../../src/domain/timer/phase';
import { IDLE, startFocus } from '../../../src/domain/timer/phase';
import type { ItemDef } from '../../../shared/content/schema';
import { ApiError, type HandlerCtx } from '../context';
import { OWNED_TABLES, keyOf } from '../schema';
import { ensureIsland, hasIsland, profileView, pull, strip, userState } from '../user';

type Handler<O extends Op> = (c: HandlerCtx, args: OpArgs<O>) => Promise<OpResult<O>>;
export type Handlers = { [O in Op]?: Handler<O> };

/** A running session older than its plan plus this is stale (the app was closed): a new start abandons it. */
const STALE_AFTER_MS = 2 * 3_600_000;
/** Gold a first-sign-in upload may carry over (§5.7; local saves can be edited). */
export const IMPORTED_GOLD_CAP = 1000;

const buildingsInput = (list: readonly PlacedBuilding[]) => list.map((b) => ({ id: b.id, defId: b.defId, tile: { x: b.tileX, z: b.tileZ }, rotation: b.rotation }));

/** A full set of placed buildings fits: owned often enough, each on valid tiles, room left for animals. */
function layoutProblem(seed: number, level: number, buildings: readonly PlacedBuilding[], owned: Parameters<typeof ownedCount>[0]): string | null {
  const counts = new Map<string, number>();
  for (const b of buildings) counts.set(b.defId, (counts.get(b.defId) ?? 0) + 1);
  for (const [defId, n] of counts) if (ownedCount(owned, defId) < n) return `not owned: ${defId}`;
  if (new Set(buildings.map((b) => b.id)).size !== buildings.length) return 'duplicate id';
  const grid = getOccupancy({ seed, islandLevel: level, animals: [], buildings: buildingsInput(buildings) });
  for (const b of buildings) {
    const problem = placementProblem(grid, { defId: b.defId, tile: { x: b.tileX, z: b.tileZ }, rotation: b.rotation, minFreeTiles: balance.build.minFreeTiles, movingId: b.id });
    if (problem) return problem;
  }
  return null;
}

export const coreHandlers: Handlers = {
  async me(c) {
    return { profile: profileView(await c.w.profile()), hasData: await hasIsland(c.tx, c.userId) };
  },

  /** Server-timestamped start (Step 5.5): at most one running session per user across devices. */
  async start_session(c, args) {
    const { focusMinutes } = balance.timer;
    if (args.plannedMs < focusMinutes.min * 60_000 || args.plannedMs > focusMinutes.max * 60_000) throw new ApiError('invalid');
    await ensureIsland(c);
    for (const s of await c.tx.table('sessions').find({ userId: c.userId, status: 'running' })) {
      const stale = c.now > s.startedAt + s.plannedFocusMs + STALE_AFTER_MS;
      if (!stale && !args.force) throw new ApiError('session_already_running');
      await c.w.put('sessions', { ...strip(s), status: 'abandoned', endedAt: c.now, effectiveFocusMs: effectiveFocusMs(c.now - s.startedAt) });
    }
    const session: FocusSession = { id: c.env.uuid(), startedAt: c.now, plannedFocusMs: args.plannedMs, status: 'running', togetherRoomId: args.roomId ?? null, verified: true };
    await c.w.put('sessions', session);
    return { session };
  },

  /**
   * Ends a session (Step 5.5): the end time is clamped into [start, now]; a completed one rolls tier and
   * species with the shared rule and the server's randomness, places the animal with the shared rule,
   * and writes session + animal together.
   */
  async end_session(c, args) {
    const stored = await c.tx.table('sessions').get(args.sessionId);
    if (!stored || stored.userId !== c.userId) throw new ApiError('not_found');
    if (stored.status !== 'running') {
      const animal = stored.rewardAnimalId ? await c.tx.table('animals').get(stored.rewardAnimalId) : undefined;
      return { session: strip(stored), animal: animal ? strip(animal) : null };
    }
    const endedAt = Math.min(c.now, Math.max(stored.startedAt, args.endedAt));
    const effective = effectiveFocusMs(endedAt - stored.startedAt);
    const session: FocusSession = { ...strip(stored), status: args.status, endedAt, effectiveFocusMs: effective };
    let animal: PlacedAnimal | null = null;
    const species = args.status === 'completed' ? rollReward(effective, c.env.random) : undefined;
    if (species) {
      const island = await ensureIsland(c);
      const state = await userState(c.tx, c.userId);
      const tile = pickNewAnimalTile(island.seed, state.animals, c.env.random, buildingsInput(state.buildings));
      if (tile) {
        animal = newPlacedAnimal(c.env.uuid(), species, tile, endedAt, session.id);
        if (chosenSkins(state.equipped, species.id).length > 1) animal.skinId = pickSpawnSkin(state.equipped, species.id, c.env.random);
        session.rewardAnimalId = animal.id;
        await c.w.put('animals', animal);
      }
    }
    await c.w.put('sessions', session);
    return { session, animal };
  },

  async sync_pull() {
    return {};
  },

  /** Outbox of non-economic changes (Step 5.6). */
  async sync_push(c, args) {
    for (const op of args.ops) {
      switch (op.kind) {
        case 'equip': {
          const { cosmetics } = await userState(c.tx, c.userId);
          await c.w.put('equipped', sanitizeEquipped(op.equipped, cosmetics));
          break;
        }
        case 'dismiss_notice': {
          const n = await c.tx.table('notices').get(op.id);
          if (n && n.userId === c.userId && !n.dismissed) await c.w.put('notices', { ...strip(n), dismissed: true });
          break;
        }
        case 'presence_setting': {
          const p = await c.w.profile();
          await c.tx.table('profiles').put({ ...p, showPresence: op.showPresence });
          break;
        }
        case 'local_session':
          await storeLocalSession(c, op.session, op.animal);
          break;
      }
    }
    return {};
  },

  /** Spends gold and grants the item in one transaction (Step 5.5); the catalog is the server's (Step 5.8). */
  async purchase(c, args) {
    const state = await userState(c.tx, c.userId);
    const discovered = new Set(state.animals.map((a) => a.speciesId));
    const problem = buyProblem(args.defId, state.cosmetics, { now: c.now, clientVersion: c.caller.appVersion, discovered });
    if (problem) throw new ApiError(problem === 'owned' ? 'already_owned' : problem === 'species_not_found' ? 'species_not_found' : 'item_unavailable');
    const item = content.get(args.defId) as ItemDef;
    const price = item.price ?? 0;
    if (state.gold < price) throw new ApiError('insufficient_gold');
    const grant = grantFor(item, c.env.uuid(), c.now);
    await c.w.put('ledger', { id: c.env.uuid(), at: c.now, currency: 'gold', amount: -price, reason: LEDGER_REASON.purchase, refId: args.defId });
    await c.w.put('cosmetics_owned', grant);
    return { item: grant };
  },

  /** Validates and stores the whole building layout (Step 3.11 rules); displaced animals walk to free tiles. */
  async apply_layout(c, args) {
    const island = await ensureIsland(c);
    const state = await userState(c.tx, c.userId);
    const level = islandLevel(state.animals);
    if (layoutProblem(island.seed, level, args.buildings, state.cosmetics)) throw new ApiError('layout_invalid');
    const next = new Map(args.buildings.map((b) => [b.id, b]));
    for (const b of state.buildings) if (!next.has(b.id)) await c.w.put('placed_buildings', { ...b, deleted: true });
    for (const b of args.buildings) {
      const before = state.buildings.find((x) => x.id === b.id);
      if (!before) {
        const other = await c.tx.table('placed_buildings').get(b.id);
        if (other && other.userId !== c.userId) throw new ApiError('invalid');
      }
      if (!before || before.tileX !== b.tileX || before.tileZ !== b.tileZ || before.rotation !== b.rotation || before.defId !== b.defId) await c.w.put('placed_buildings', b);
    }
    // Pinned positions (Phase 10) come with the layout; everyone else is repaired around the buildings.
    let animals = state.animals;
    if (args.animals?.length) {
      const grid = getOccupancy({ seed: island.seed, islandLevel: level, animals: [], buildings: buildingsInput(args.buildings) });
      const byId = new Map(args.animals.map((a) => [a.id, a]));
      animals = animals.map((a) => {
        const want = byId.get(a.id);
        if (!want || !isActive(a)) return a;
        const info = grid.get(tileKey({ x: want.tileX, z: want.tileZ }));
        if (!info || !isStandable(info)) throw new ApiError('layout_invalid');
        return { ...a, tileX: want.tileX, tileZ: want.tileZ, pinned: want.pinned };
      });
      const perTile = new Map<string, number>();
      for (const a of animals.filter(isActive)) perTile.set(tileKey(animalTile(a)), (perTile.get(tileKey(animalTile(a))) ?? 0) + 1);
      if ([...perTile.values()].some((n) => n > balance.placement.maxPerTile)) throw new ApiError('layout_invalid');
      for (const a of animals) {
        const old = state.animals.find((x) => x.id === a.id)!;
        if (old.tileX !== a.tileX || old.tileZ !== a.tileZ || old.pinned !== a.pinned) await c.w.put('animals', a);
      }
    }
    const moved = repairPlacements({ seed: island.seed, islandLevel: level, buildings: buildingsInput(args.buildings) }, animals.filter(isActive));
    for (const a of moved) await c.w.put('animals', { ...a, pinned: false });
    return {};
  },

  /** The island move rule (Step 4.1) on the server; needs no running session. */
  async move_island(c, args) {
    const island = await ensureIsland(c);
    const running = await c.tx.table('sessions').find({ userId: c.userId, status: 'running' });
    const state = await userState(c.tx, c.userId);
    const history = (await c.tx.table('island_history').find({ userId: c.userId })).map(strip);
    const out = moveIsland({
      phase: running.length ? startFocus(running[0]!.startedAt, running[0]!.plannedFocusMs, running[0]!.id) : IDLE,
      world: island,
      animals: state.animals,
      buildings: state.buildings,
      history,
      newSeed: args.seed,
      now: c.now,
      rng: c.env.random,
      historyId: c.env.uuid(),
    });
    if (typeof out === 'string') throw new ApiError(out);
    await c.w.put('island_state', { ...island, seed: out.world.seed });
    for (const a of out.animals) await c.w.put('animals', a);
    for (const b of state.buildings) await c.w.put('placed_buildings', { ...b, deleted: true });
    await c.w.put('island_history', out.history);
    return {};
  },

  /** The newest published pack this client can use (Step 5.8). */
  async get_content_manifest(c, args) {
    const releases = await c.tx.table('content_releases').find({});
    const usable = releases
      .filter((r) => compareVersions(r.minClientVersion, args.clientVersion) <= 0)
      .sort((a, b) => compareVersions(b.contentVersion, a.contentVersion));
    const r = usable[0];
    return { manifest: r ? { contentVersion: r.contentVersion, minClientVersion: r.minClientVersion, packUrl: r.packUrl, atlasUrl: r.atlasUrl, checksum: r.checksum } : null };
  },

  /**
   * First sign-in (Step 5.7): an empty account takes the device's save; `replace` overwrites an account
   * that has data. Local animals are trusted once (verified); gold carries over up to a cap; buildings that
   * do not fit and items the catalog does not know are dropped.
   */
  async upload_local_save(c, args) {
    if (await hasIsland(c.tx, c.userId)) {
      if (!args.replace) throw new ApiError('account_not_empty');
      for (const t of OWNED_TABLES) for (const row of await c.tx.table(t).find({ userId: c.userId } as never)) await c.tx.table(t).delete(keyOf(t, row));
    }
    const { save } = args;
    await c.w.put('island_state', { seed: save.world.seed, blockThemeId: save.world.blockThemeId });
    for (const s of save.sessions) await c.w.insert('sessions', { ...s, status: s.status === 'running' ? 'abandoned' : s.status });
    for (const a of save.animals) await c.w.insert('animals', { ...a, verified: true, tierRank: getSpecies(a.speciesId).tierRank });
    const known = save.cosmetics.filter((x) => content.get(x.defId)?.kind === x.kind);
    for (const x of known) await c.w.insert('cosmetics_owned', x);
    const gold = Math.max(0, Math.min(IMPORTED_GOLD_CAP, save.ledger.reduce((s, e) => s + e.amount, 0)));
    await c.w.put('ledger', { id: c.env.uuid(), at: c.now, currency: 'gold', amount: gold, reason: 'local_save', refId: null });
    const level = islandLevel(save.animals);
    const fits = layoutProblem(save.world.seed, level, save.placedBuildings, known) === null ? save.placedBuildings : [];
    for (const b of fits) await c.w.insert('placed_buildings', b);
    if (save.equipped) await c.w.put('equipped', sanitizeEquipped(save.equipped, known));
    for (const h of save.islandHistory) await c.w.insert('island_history', h);
    return {};
  },

  async export_account(c) {
    const delta = await pull(c.tx, c.userId, 0);
    return { profile: profileView(await c.w.profile()), rows: delta.rows };
  },

  /** In-app account deletion (Step 5.4): every row of the user, then the auth user (host hook). */
  async delete_account(c) {
    for (const t of OWNED_TABLES) for (const row of await c.tx.table(t).find({ userId: c.userId } as never)) await c.tx.table(t).delete(keyOf(t, row));
    for (const d of await c.tx.table('devices').find({ userId: c.userId })) await c.tx.table('devices').delete(d.deviceId);
    await c.tx.table('profiles').delete(c.userId);
    return {};
  },

  async register_device(c, args) {
    await c.tx.table('devices').put({ ...args, userId: c.userId, categories: args.categories ?? {}, lastSeen: c.now });
    return {};
  },
};

/** An offline-started session (§9 Q16): stored unverified; its animal stays out of score and war and leaves no gold. */
async function storeLocalSession(c: HandlerCtx, session: FocusSession, animal: PlacedAnimal | null) {
  if (session.status === 'running' || !session.endedAt || session.endedAt > c.now || session.endedAt < session.startedAt) throw new ApiError('invalid');
  if (await c.tx.table('sessions').get(session.id)) return; // already uploaded
  // No overlap with another session of this user: one real focus at a time.
  const all = await c.tx.table('sessions').find({ userId: c.userId });
  if (all.some((s) => s.startedAt < session.endedAt! && (s.endedAt ?? c.now) > session.startedAt)) throw new ApiError('invalid');
  await c.w.insert('sessions', { ...session, verified: false });
  if (!animal) return;
  const effective = effectiveFocusMs(session.endedAt - session.startedAt);
  if (effective < balance.reward.minFocusMs || animal.sessionId !== session.id) throw new ApiError('invalid');
  const species = getSpecies(animal.speciesId);
  const island = await ensureIsland(c);
  const state = await userState(c.tx, c.userId);
  const grid = getOccupancy({ seed: island.seed, islandLevel: islandLevel(state.animals) + 1, animals: [], buildings: buildingsInput(state.buildings) });
  const info = grid.get(tileKey(animalTile(animal)));
  const tile = info && isStandable(info) ? animalTile(animal) : pickNewAnimalTile(island.seed, state.animals, c.env.random, buildingsInput(state.buildings));
  if (!tile) return;
  await c.w.insert('animals', { ...newPlacedAnimal(animal.id, species, tile, Math.min(animal.acquiredAt, c.now), session.id), verified: false, ...(animal.skinId && { skinId: animal.skinId }) });
}

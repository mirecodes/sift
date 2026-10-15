import { createStore } from 'zustand/vanilla';
import { config, DEFAULT_BLOCK_THEME } from '../domain/config';
import type { Equipped, FocusSession, InboxRow, LedgerEntry, OwnedCosmetic, PlacedAnimal, PlacedBuilding, Settings, WorldState } from '../domain/types';
import { buyProblem, DEFAULT_EQUIPPED, equipSkin, equipTheme, grantFor, ownedCount, sanitizeEquipped, type BuyProblem, type EquipProblem } from '../domain/cosmetics/inventory';
import { content } from '../domain/content';
import { placementProblem } from '../domain/build/placement';
import { balance } from '../../shared/balance/balance';
import { debitEntry, goldBalance, goldEntry, hasStarterGrant, LEDGER_REASON } from '../domain/economy/ledger';
import { computeExpirations } from '../../shared/rules/expiry';
import { canShowNotices, currentNotice, pendingDepartures, type Notice } from '../domain/inbox/inbox';
import {
  IDLE,
  effectiveFocusMs,
  minutesToMs,
  resolvePhase,
  startBreak,
  startFocus,
  type StoredPhase,
} from '../domain/timer/phase';
import type { AnimalSpecies } from '../domain/animals/catalog';
import { rollReward } from '../domain/reward/reward';
import { isActive, newPlacedAnimal } from '../domain/animals/placed';
import { islandLevel, pickNewAnimalTile } from '../domain/island/level';
import { animalTile, getOccupancy, repairPlacements } from '../domain/island/occupancy';
import { clamp, type Rng } from '../domain/random';
import { createBackup, type Backup } from '../domain/backup';
import type { StorageAdapter } from '../platform/storage';
import { createMemoryStorage } from '../platform/storage/memory';

export type View = 'home' | 'settings' | 'collection';
/** Top-level tabs (guidance_v2 §2.10). `view` is the page inside the Island tab. */
export type Tab = 'island' | 'stats' | 'friends' | 'group';

export interface AppDeps {
  storage: StorageAdapter;
  now: () => number;
  rng: Rng;
  uuid: () => string;
  /** Test mode: these species start on the island (in memory only, never persisted). */
  testSpecies?: AnimalSpecies[];
  /** Start with a new island seed and no placed animals (stored animals are deleted). */
  resetMap?: boolean;
  /** Test mode: sample data added in memory only, never persisted (ADR-038). */
  dummy?: {
    sessions: FocusSession[];
    inbox: InboxRow[];
    ledger?: LedgerEntry[];
    /** Placed on free tiles at startup, like test species. */
    animals?: { species: AnimalSpecies; acquiredAt: number }[];
    /** Owned items (Phase 3). */
    cosmetics?: OwnedCosmetic[];
    equipped?: Equipped;
    /** Owned buildings placed on the first valid tiles near the center at startup. */
    buildings?: string[];
  };
  /** `features.economy`: starter gold and animal expiry run only when on. */
  economy?: boolean;
  /** Running app version, for content `minClientVersion`. */
  clientVersion?: string;
}

export interface AppState {
  ready: boolean;
  settings: Settings;
  world: WorldState;
  animals: PlacedAnimal[];
  sessions: FocusSession[];
  /** Persisted phase. Overtime / break-over are derived with `resolvePhase`. */
  phase: StoredPhase;
  view: View;
  /** Kept in memory only: every launch opens on Island. */
  activeTab: Tab;
  /** Animal earned this break that has not been revealed yet; hidden from the island until then. */
  revealPending: string | null;
  /** Deferred notices (ADR-035), oldest first. Shown one at a time on Home and Break only. */
  inbox: InboxRow[];
  /** Wallet balance: the ledger sum, recomputed on load. */
  gold: number;
  /** Owned items, one row per instance (Step 3.7). */
  cosmetics: OwnedCosmetic[];
  /** Equipped skins (per species) and block theme. */
  equipped: Equipped;
  placedBuildings: PlacedBuilding[];

  init(): Promise<void>;
  exportBackup(): Promise<Backup>;
  /** Replaces all local data with a validated backup, atomically, and reloads the store. */
  importBackup(backup: Backup): Promise<void>;
  startFocus(): Promise<void>;
  endFocus(): Promise<void>;
  abandonFocus(): Promise<void>;
  goHome(): Promise<void>;
  finishReveal(): void;
  setView(view: View): void;
  /** Ignored while focusing: the tab bar is hidden and Focus stays on Island. */
  setTab(tab: Tab): void;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  /** Queues a notice at any time, including during Focus; it is shown later. */
  enqueueNotice(notice: Notice): Promise<void>;
  /** Removes the shown notice. Ignored while focusing: nothing is dequeued during Focus. */
  dismissNotice(id: string): Promise<void>;
  /**
   * Departs every expired active animal (Step 2.2): statuses, gold credits and one
   * `animals_departed` notice in one write. No-op while focusing or with the economy off.
   */
  applyExpirations(): Promise<void>;
  /**
   * Writes the debit and the granted item in one transaction, or nothing.
   * Rejects with `InsufficientGoldError` when the balance is short.
   */
  spendGold(amount: number, reason: string, refId: string | null, grant: OwnedCosmetic): Promise<void>;
  /**
   * Buys one shop item (Step 3.9): debit and inventory row in one write. Rejects with a `BuyError`
   * (not for sale, already owned, species not found) or `InsufficientGoldError`.
   */
  buyItem(defId: string): Promise<void>;
  /** Equips an owned skin (or `default`) for every animal of a species. Rejects with an `EquipError`. */
  equipSkin(speciesId: string, skinId: string): Promise<void>;
  /** Equips an owned block theme (or `default`). Rejects with an `EquipError`. */
  equipTheme(themeId: string): Promise<void>;
}

export class BuyError extends Error {
  constructor(readonly problem: BuyProblem) {
    super(`Cannot buy: ${problem}`);
    this.name = 'BuyError';
  }
}

export class EquipError extends Error {
  constructor(readonly problem: EquipProblem) {
    super(`Cannot equip: ${problem}`);
    this.name = 'EquipError';
  }
}

/** Species earned at least once, whatever happened to the animal (their skins are for sale). */
export function selectDiscoveredSpecies(s: Pick<AppState, 'animals'>): Set<string> {
  return new Set(s.animals.map((a) => a.speciesId));
}

export const DEFAULT_SETTINGS: Settings = {
  focusMinutes: config.settings.focusMinutes.default,
  breakMinutes: config.settings.breakMinutes.default,
  soundEnabled: config.settings.soundEnabled,
  theme: 'light',
  weekStartsOn: config.settings.weekStartsOn,
  showFocusPresence: config.settings.showFocusPresence,
  liveProgress: config.settings.liveProgress,
};

export function sanitizeSettings(input: Partial<Settings> | undefined): Settings {
  const { focusMinutes: f, breakMinutes: b } = config.settings;
  const merged = { ...DEFAULT_SETTINGS, ...input };
  const minutes = (v: unknown, range: { default: number; min: number; max: number }) => {
    const n = Number(v);
    return clamp(Number.isFinite(n) ? Math.round(n) : range.default, range.min, range.max);
  };
  return {
    focusMinutes: minutes(merged.focusMinutes, f),
    breakMinutes: minutes(merged.breakMinutes, b),
    soundEnabled: Boolean(merged.soundEnabled),
    theme: merged.theme === 'dark' ? 'dark' : 'light',
    weekStartsOn: merged.weekStartsOn === 0 ? 0 : 1,
    showFocusPresence: Boolean(merged.showFocusPresence),
    liveProgress: Boolean(merged.liveProgress),
  };
}

/**
 * Animals that should be drawn right now: active ones, minus the pending reward until the reveal,
 * plus departed ones still `leaving` (their departure notice has not been dismissed, Step 2.3).
 */
export function selectVisibleAnimals(s: Pick<AppState, 'animals' | 'revealPending'>, leaving?: ReadonlySet<string>): PlacedAnimal[] {
  return s.animals.filter((a) => (isActive(a) || leaving?.has(a.id)) && a.id !== s.revealPending);
}

/** Gold the user has been told about: departure gold joins when its notice shows (Step 2.5). */
export function selectShownGold(s: Pick<AppState, 'gold' | 'inbox' | 'phase'>): number {
  return s.gold - pendingDepartures(s.inbox, s.phase).heldGold;
}

/** Unicorns on the island (the island-move currency). */
export function selectActiveUnicorns(s: Pick<AppState, 'animals'>): number {
  return s.animals.filter((a) => isActive(a) && a.speciesId === 'unicorn').length;
}

/** The notice to show now, or `undefined` (always while focusing). */
export function selectCurrentNotice(s: Pick<AppState, 'inbox' | 'phase'>): InboxRow | undefined {
  return currentNotice(s.inbox, s.phase);
}

/**
 * Island level (lifetime earned animals, ADR-032). During a break the reward is not counted, so
 * the island grows only once the user is back on Home (ADR-013).
 */
export function selectIslandLevel(s: Pick<AppState, 'animals' | 'phase'>): number {
  const holdBack = s.phase.kind === 'break' && s.phase.rewardId !== undefined ? 1 : 0;
  return Math.max(0, islandLevel(s.animals) - holdBack);
}

export function createAppStore(initialDeps: AppDeps) {
  const deps = { ...initialDeps };
  /** Test-mode and dummy animals: they live in memory only, so their changes are never stored. */
  const memoryOnly = new Set<string>();
  let expiring: Promise<void> | null = null;

  /** Persistence must never block the cycle: fall back to memory if storage fails. */
  async function commit(change: Parameters<StorageAdapter['commit']>[0]): Promise<void> {
    try {
      await deps.storage.commit(change);
    } catch (error) {
      console.warn('Sift: storage unavailable, continuing without persistence.', error);
      deps.storage = createMemoryStorage();
      await deps.storage.commit(change);
    }
  }

  /** Reads storage into the store. Developer switches apply only on the first start, never after an import. */
  async function hydrate(devSwitches: boolean): Promise<Partial<AppState>> {
    let loaded;
    try {
      loaded = await deps.storage.load();
    } catch (error) {
      console.warn('Sift: could not read storage, starting fresh in memory.', error);
      deps.storage = createMemoryStorage();
      loaded = await deps.storage.load();
    }

    const resetMap = devSwitches && deps.resetMap;
    const settings = sanitizeSettings(loaded.settings);
    let world = loaded.world;
    let stored = loaded.animals;
    if (resetMap || !world) {
      world = { seed: Math.floor(deps.rng() * 2 ** 31), blockThemeId: DEFAULT_BLOCK_THEME };
      if (resetMap) stored = [];
      await deps.storage.resetWorld(world).catch(() => undefined);
    }

    // Save repair (Step 0.7): active animals on water, camp or reserved tiles move to the nearest free tile.
    const repaired = repairPlacements({ seed: world.seed, islandLevel: islandLevel(stored), buildings: [] }, stored.filter(isActive));
    if (repaired.length) {
      const byId = new Map(repaired.map((a) => [a.id, a]));
      stored = stored.map((a) => byId.get(a.id) ?? a);
      await commit({ animals: repaired });
    }

    const phase = loaded.phase ?? IDLE;
    const rewardId = phase.kind === 'break' ? phase.rewardId : undefined;
    const revealPending = rewardId && stored.some((a) => a.id === rewardId) ? rewardId : null;

    const animals = [...stored];
    memoryOnly.clear();
    const extra = devSwitches
      ? [...(deps.testSpecies ?? []).map((species) => ({ species, acquiredAt: deps.now() })), ...(deps.dummy?.animals ?? [])]
      : [];
    for (const { species, acquiredAt } of extra) {
      const tile = pickNewAnimalTile(world.seed, animals, deps.rng);
      if (!tile) continue;
      const animal = newPlacedAnimal(deps.uuid(), species, tile, acquiredAt, 'test-mode');
      memoryOnly.add(animal.id);
      animals.push(animal);
    }

    let ledger = loaded.ledger;
    if (deps.economy && !hasStarterGrant(ledger)) {
      const starter = goldEntry(deps.uuid(), deps.now(), balance.economy.starterGold, LEDGER_REASON.starter, null);
      await commit({ ledgerAdd: [starter] });
      ledger = [...ledger, starter];
    }

    const dummy = devSwitches ? deps.dummy : undefined;
    const cosmetics = [...loaded.cosmetics, ...(dummy?.cosmetics ?? [])];
    // ponytail: placed buildings beyond the owned count (e.g. placed with dummy items) are ignored, not deleted.
    const placedBuildings = loaded.placedBuildings.filter((b, i, all) => all.slice(0, i + 1).filter((x) => x.defId === b.defId).length <= ownedCount(cosmetics, b.defId));
    for (const defId of dummy?.buildings ?? []) {
      const building = placeDummyBuilding(defId, world.seed, animals, placedBuildings);
      if (!building) continue;
      memoryOnly.add(building.id);
      placedBuildings.push(building);
    }
    return {
      cosmetics,
      equipped: sanitizeEquipped(dummy?.equipped ?? loaded.equipped, cosmetics),
      placedBuildings,
      gold: goldBalance([...ledger, ...(dummy?.ledger ?? [])]),
      ready: true,
      settings,
      world,
      animals,
      sessions: dummy ? [...dummy.sessions, ...loaded.sessions] : loaded.sessions,
      phase,
      revealPending,
      inbox: dummy ? [...loaded.inbox, ...dummy.inbox] : loaded.inbox,
    };
  }

  /** Dummy data: the first free, valid tile from the center (no animal on it). */
  function placeDummyBuilding(defId: string, seed: number, animals: readonly PlacedAnimal[], placed: readonly PlacedBuilding[]): PlacedBuilding | null {
    const grid = getOccupancy({
      seed,
      islandLevel: islandLevel(animals),
      animals: animals.filter(isActive).map((a) => ({ id: a.id, tile: animalTile(a) })),
      buildings: placed.map((b) => ({ id: b.id, defId: b.defId, tile: { x: b.tileX, z: b.tileZ }, rotation: b.rotation })),
    });
    const tiles = [...grid.values()].filter((t) => !t.animalIds.length).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z) || a.x - b.x || a.z - b.z);
    const tile = tiles.find((t) => placementProblem(grid, { defId, tile: t, rotation: 0, minFreeTiles: balance.build.minFreeTiles }) === null);
    return tile ? { id: deps.uuid(), defId, tileX: tile.x, tileZ: tile.z, rotation: 0, placedAt: deps.now() } : null;
  }

  async function expire(): Promise<void> {
    const { getState: get, setState: set } = store;
    const { phase, animals } = get();
    if (!deps.economy || !canShowNotices(phase)) return; // never while focusing
    const now = deps.now();
    const due = computeExpirations(animals, now, balance.economy);
    if (!due.length) return;

    const byId = new Map(animals.map((a) => [a.id, a]));
    const departed = due.map(({ animalId, expiredAt }): PlacedAnimal => ({
      ...byId.get(animalId)!,
      status: 'departed',
      endedAt: expiredAt,
      endReason: 'expired',
    }));
    // Stored and memory-only animals never share a write or a notice.
    const groups = [due.filter((d) => !memoryOnly.has(d.animalId)), due.filter((d) => memoryOnly.has(d.animalId))];
    const inboxAdd: InboxRow[] = [];
    let gained = 0;
    for (const [i, group] of groups.entries()) {
      if (!group.length) continue;
      const gold = group.reduce((sum, d) => sum + d.gold, 0);
      const ids = group.map((d) => d.animalId);
      const row: InboxRow = { id: deps.uuid(), createdAt: now, notice: { kind: 'animals_departed', animalIds: ids, gold } };
      if (i === 0) {
        const credits = group.filter((d) => d.gold > 0).map((d) => goldEntry(deps.uuid(), d.expiredAt, d.gold, LEDGER_REASON.expiry, d.animalId));
        await commit({ animals: departed.filter((a) => !memoryOnly.has(a.id)), ledgerAdd: credits, inboxAdd: [row] });
      }
      inboxAdd.push(row);
      gained += gold;
    }
    const changed = new Map(departed.map((a) => [a.id, a]));
    set({
      animals: get().animals.map((a) => changed.get(a.id) ?? a),
      gold: get().gold + gained,
      inbox: [...get().inbox, ...inboxAdd],
    });
  }

  const store = createStore<AppState>()((set, get) => ({
    ready: false,
    settings: DEFAULT_SETTINGS,
    world: { seed: 0, blockThemeId: DEFAULT_BLOCK_THEME },
    animals: [],
    sessions: [],
    phase: IDLE,
    view: 'home',
    activeTab: 'island',
    revealPending: null,
    inbox: [],
    gold: 0,
    cosmetics: [],
    equipped: DEFAULT_EQUIPPED,
    placedBuildings: [],

    async init() {
      set(await hydrate(true));
      await get().applyExpirations();
    },

    async exportBackup() {
      return createBackup(await deps.storage.exportAll(), deps.storage.schemaVersion, deps.now());
    },

    async importBackup(backup) {
      await deps.storage.importAll(backup.data, backup.schemaVersion);
      set(await hydrate(false));
      await get().applyExpirations();
    },

    async startFocus() {
      const { phase, settings, sessions } = get();
      if (phase.kind === 'focus') return;
      const now = deps.now();
      const plannedMs = minutesToMs(settings.focusMinutes);
      const session: FocusSession = { id: deps.uuid(), startedAt: now, plannedFocusMs: plannedMs, status: 'running', togetherRoomId: null };
      const next = startFocus(now, plannedMs, session.id);
      await commit({ session, phase: next });
      set({ phase: next, sessions: [...sessions, session], revealPending: null, view: 'home', activeTab: 'island' });
    },

    async endFocus() {
      const { phase, sessions, animals, world, settings } = get();
      const now = deps.now();
      const resolved = resolvePhase(phase, now);
      if (resolved.kind !== 'focusOvertime') return; // only after the planned time (flow in 4.2)

      const effective = effectiveFocusMs(now - resolved.startedAt);
      const existing = sessions.find((s) => s.id === resolved.sessionId);
      const session: FocusSession = {
        id: resolved.sessionId,
        startedAt: resolved.startedAt,
        plannedFocusMs: resolved.plannedMs,
        togetherRoomId: null,
        ...existing,
        status: 'completed',
        endedAt: now,
        effectiveFocusMs: effective,
      };

      let animal: PlacedAnimal | undefined;
      const species = rollReward(effective, deps.rng);
      if (species) {
        const tile = pickNewAnimalTile(world.seed, animals, deps.rng);
        if (tile) {
          animal = newPlacedAnimal(deps.uuid(), species, tile, now, session.id);
          session.rewardAnimalId = animal.id;
        }
      }

      const next = startBreak(now, minutesToMs(settings.breakMinutes), animal?.id);
      await commit(animal ? { session, animal, phase: next } : { session, phase: next });
      set({
        phase: next,
        sessions: sessions.some((s) => s.id === session.id)
          ? sessions.map((s) => (s.id === session.id ? session : s))
          : [...sessions, session],
        animals: animal ? [...animals, animal] : animals,
        revealPending: animal?.id ?? null,
      });
      await get().applyExpirations(); // animals that expired during Focus leave now
    },

    async abandonFocus() {
      const { phase, sessions } = get();
      const now = deps.now();
      const resolved = resolvePhase(phase, now);
      if (resolved.kind !== 'focus') return; // once planned time is reached, use End focus
      const existing = sessions.find((s) => s.id === resolved.sessionId);
      const session: FocusSession = {
        id: resolved.sessionId,
        startedAt: resolved.startedAt,
        plannedFocusMs: resolved.plannedMs,
        togetherRoomId: null,
        ...existing,
        status: 'abandoned',
        endedAt: now,
        effectiveFocusMs: effectiveFocusMs(now - resolved.startedAt),
      };
      await commit({ session, phase: IDLE });
      set({
        phase: IDLE,
        sessions: sessions.map((s) => (s.id === session.id ? session : s)),
        revealPending: null,
      });
      await get().applyExpirations();
    },

    async goHome() {
      const { phase } = get();
      if (phase.kind !== 'break') return;
      await commit({ phase: IDLE });
      set({ phase: IDLE, revealPending: null, view: 'home' });
      await get().applyExpirations();
    },

    finishReveal() {
      if (get().revealPending) set({ revealPending: null });
    },

    setView(view) {
      set({ view });
    },

    setTab(tab) {
      if (get().phase.kind === 'focus') return;
      // Leaving Island ends a running reveal, so the new animal is on the island on return.
      set({ activeTab: tab, view: 'home', ...(tab !== 'island' && { revealPending: null }) });
    },

    async updateSettings(patch) {
      const settings = sanitizeSettings({ ...get().settings, ...patch });
      set({ settings });
      await deps.storage.saveSettings(settings).catch((e) => console.warn('Sift: could not save settings.', e));
    },

    async enqueueNotice(notice) {
      const row: InboxRow = { id: deps.uuid(), createdAt: deps.now(), notice };
      await commit({ inboxAdd: [row] });
      set({ inbox: [...get().inbox, row] });
    },

    async dismissNotice(id) {
      const { inbox, phase } = get();
      if (!canShowNotices(phase) || !inbox.some((n) => n.id === id)) return;
      await commit({ inboxRemove: [id] });
      set({ inbox: get().inbox.filter((n) => n.id !== id) });
    },

    async spendGold(amount, reason, refId, grant) {
      const debit = debitEntry(get().gold, amount, reason, refId, deps.uuid(), deps.now());
      // No memory fallback here: a failed purchase must fail visibly and change nothing.
      await deps.storage.commit({ ledgerAdd: [debit], cosmeticsAdd: [grant] });
      set({ gold: get().gold + debit.amount, cosmetics: [...get().cosmetics, grant] });
    },

    async buyItem(defId) {
      const problem = buyProblem(defId, get().cosmetics, { now: deps.now(), clientVersion: deps.clientVersion ?? '0.0.0', discovered: selectDiscoveredSpecies(get()) });
      if (problem) throw new BuyError(problem);
      const item = content.get(defId) as Parameters<typeof grantFor>[0];
      await get().spendGold(item.price!, LEDGER_REASON.purchase, defId, grantFor(item, deps.uuid(), deps.now()));
    },

    async equipSkin(speciesId, skinId) {
      const next = equipSkin(get().equipped, get().cosmetics, speciesId, skinId);
      if (typeof next === 'string') throw new EquipError(next);
      await commit({ equipped: next });
      set({ equipped: next });
    },

    async equipTheme(themeId) {
      const next = equipTheme(get().equipped, get().cosmetics, themeId);
      if (typeof next === 'string') throw new EquipError(next);
      await commit({ equipped: next });
      set({ equipped: next });
    },

    applyExpirations() {
      // One run at a time, so a timer tick and a phase change never credit the same animal twice.
      expiring ??= expire().finally(() => (expiring = null));
      return expiring;
    },
  }));
  return store;
}

export type AppStore = ReturnType<typeof createAppStore>;

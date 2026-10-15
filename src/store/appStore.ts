import { createStore } from 'zustand/vanilla';
import { config } from '../domain/config';
import type { FocusSession, PlacedAnimal, Settings, WorldState } from '../domain/types';
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
import { islandSide, islandTiles, pickPlacementTile } from '../domain/island/island';
import { clamp, type Rng } from '../domain/random';
import { createBackup, type Backup } from '../domain/backup';
import type { StorageAdapter } from '../platform/storage';
import { createMemoryStorage } from '../platform/storage/memory';

export type View = 'home' | 'settings' | 'collection';

export interface AppDeps {
  storage: StorageAdapter;
  now: () => number;
  rng: Rng;
  uuid: () => string;
  /** Test mode: these species start on the island (in memory only, never persisted). */
  testSpecies?: AnimalSpecies[];
  /** Start with a new island seed and no placed animals (stored animals are deleted). */
  resetMap?: boolean;
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
  /** Animal earned this break that has not been revealed yet; hidden from the island until then. */
  revealPending: string | null;

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
  updateSettings(patch: Partial<Settings>): Promise<void>;
}

export const DEFAULT_SETTINGS: Settings = {
  focusMinutes: config.settings.focusMinutes.default,
  breakMinutes: config.settings.breakMinutes.default,
  soundEnabled: config.settings.soundEnabled,
  theme: 'light',
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
  };
}

/** Animals that should be drawn right now (the pending reward is held back until the reveal). */
export function selectVisibleAnimals(s: Pick<AppState, 'animals' | 'revealPending'>): PlacedAnimal[] {
  return s.revealPending ? s.animals.filter((a) => a.id !== s.revealPending) : s.animals;
}

/**
 * Animal count that sizes the island. During a break the reward is not counted, so the
 * island grows only once the user is back on Home (ADR-013).
 */
export function selectIslandCount(s: Pick<AppState, 'animals' | 'phase'>): number {
  const holdBack = s.phase.kind === 'break' && s.phase.rewardId !== undefined ? 1 : 0;
  return Math.max(0, s.animals.length - holdBack);
}

export function createAppStore(initialDeps: AppDeps) {
  const deps = { ...initialDeps };

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
      world = { seed: Math.floor(deps.rng() * 2 ** 31) };
      if (resetMap) stored = [];
      await deps.storage.resetWorld(world).catch(() => undefined);
    }

    const phase = loaded.phase ?? IDLE;
    const rewardId = phase.kind === 'break' ? phase.rewardId : undefined;
    const revealPending = rewardId && stored.some((a) => a.id === rewardId) ? rewardId : null;

    const animals = [...stored];
    for (const species of devSwitches ? (deps.testSpecies ?? []) : []) {
      const occupied = animals.map((a) => ({ x: a.tileX, z: a.tileZ }));
      const tile = pickPlacementTile(islandTiles(world.seed, islandSide(animals.length + 1)), occupied, deps.rng);
      if (tile) animals.push({ id: deps.uuid(), speciesId: species.id, tier: species.tier, tileX: tile.x, tileZ: tile.z, acquiredAt: 0, sessionId: 'test-mode' });
    }

    return { ready: true, settings, world, animals, sessions: loaded.sessions, phase, revealPending };
  }

  return createStore<AppState>()((set, get) => ({
    ready: false,
    settings: DEFAULT_SETTINGS,
    world: { seed: 0 },
    animals: [],
    sessions: [],
    phase: IDLE,
    view: 'home',
    revealPending: null,

    async init() {
      set(await hydrate(true));
    },

    async exportBackup() {
      return createBackup(await deps.storage.exportAll(), deps.storage.schemaVersion, deps.now());
    },

    async importBackup(backup) {
      await deps.storage.importAll(backup.data, backup.schemaVersion);
      set(await hydrate(false));
    },

    async startFocus() {
      const { phase, settings, sessions } = get();
      if (phase.kind === 'focus') return;
      const now = deps.now();
      const plannedMs = minutesToMs(settings.focusMinutes);
      const session: FocusSession = { id: deps.uuid(), startedAt: now, plannedFocusMs: plannedMs, status: 'running' };
      const next = startFocus(now, plannedMs, session.id);
      await commit({ session, phase: next });
      set({ phase: next, sessions: [...sessions, session], revealPending: null, view: 'home' });
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
        ...existing,
        status: 'completed',
        endedAt: now,
        effectiveFocusMs: effective,
      };

      let animal: PlacedAnimal | undefined;
      const species = rollReward(effective, deps.rng);
      if (species) {
        const occupied = animals.map((a) => ({ x: a.tileX, z: a.tileZ }));
        const tile =
          pickPlacementTile(islandTiles(world.seed, islandSide(animals.length)), occupied, deps.rng) ??
          pickPlacementTile(islandTiles(world.seed, islandSide(animals.length + 1)), occupied, deps.rng);
        if (tile) {
          animal = {
            id: deps.uuid(),
            speciesId: species.id,
            tier: species.tier,
            tileX: tile.x,
            tileZ: tile.z,
            acquiredAt: now,
            sessionId: session.id,
          };
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
    },

    async goHome() {
      const { phase } = get();
      if (phase.kind !== 'break') return;
      await commit({ phase: IDLE });
      set({ phase: IDLE, revealPending: null, view: 'home' });
    },

    finishReveal() {
      if (get().revealPending) set({ revealPending: null });
    },

    setView(view) {
      set({ view });
    },

    async updateSettings(patch) {
      const settings = sanitizeSettings({ ...get().settings, ...patch });
      set({ settings });
      await deps.storage.saveSettings(settings).catch((e) => console.warn('Sift: could not save settings.', e));
    },
  }));
}

export type AppStore = ReturnType<typeof createAppStore>;

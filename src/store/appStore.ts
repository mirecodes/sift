import { createStore } from 'zustand/vanilla';
import { config, DEFAULT_BLOCK_THEME } from '../domain/config';
import type { FocusSession, InboxRow, PlacedAnimal, Settings, WorldState } from '../domain/types';
import { canShowNotices, currentNotice, type Notice } from '../domain/inbox/inbox';
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
import { repairPlacements } from '../domain/island/occupancy';
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
  /** Deferred notices (ADR-035), oldest first. Shown one at a time on Home and Break only. */
  inbox: InboxRow[];

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
  /** Queues a notice at any time, including during Focus; it is shown later. */
  enqueueNotice(notice: Notice): Promise<void>;
  /** Removes the shown notice. Ignored while focusing: nothing is dequeued during Focus. */
  dismissNotice(id: string): Promise<void>;
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

/** Animals that should be drawn right now: active ones, minus the pending reward until the reveal. */
export function selectVisibleAnimals(s: Pick<AppState, 'animals' | 'revealPending'>): PlacedAnimal[] {
  return s.animals.filter((a) => isActive(a) && a.id !== s.revealPending);
}

/**
 * Island level (lifetime earned animals, ADR-032). During a break the reward is not counted, so
 * the island grows only once the user is back on Home (ADR-013).
 */
/** The notice to show now, or `undefined` (always while focusing). */
export function selectCurrentNotice(s: Pick<AppState, 'inbox' | 'phase'>): InboxRow | undefined {
  return currentNotice(s.inbox, s.phase);
}

export function selectIslandLevel(s: Pick<AppState, 'animals' | 'phase'>): number {
  const holdBack = s.phase.kind === 'break' && s.phase.rewardId !== undefined ? 1 : 0;
  return Math.max(0, islandLevel(s.animals) - holdBack);
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
    for (const species of devSwitches ? (deps.testSpecies ?? []) : []) {
      const tile = pickNewAnimalTile(world.seed, animals, deps.rng);
      if (tile) animals.push(newPlacedAnimal(deps.uuid(), species, tile, 0, 'test-mode'));
    }

    return { ready: true, settings, world, animals, sessions: loaded.sessions, phase, revealPending, inbox: loaded.inbox };
  }

  return createStore<AppState>()((set, get) => ({
    ready: false,
    settings: DEFAULT_SETTINGS,
    world: { seed: 0, blockThemeId: DEFAULT_BLOCK_THEME },
    animals: [],
    sessions: [],
    phase: IDLE,
    view: 'home',
    revealPending: null,
    inbox: [],

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
      const session: FocusSession = { id: deps.uuid(), startedAt: now, plannedFocusMs: plannedMs, status: 'running', togetherRoomId: null };
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
  }));
}

export type AppStore = ReturnType<typeof createAppStore>;

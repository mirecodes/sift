import { createStore } from 'zustand/vanilla';
import { config, DEFAULT_BLOCK_THEME } from '../domain/config';
import type { Equipped, FocusSession, InboxRow, IslandHistoryEntry, LedgerEntry, OwnedCosmetic, PlacedAnimal, PlacedBuilding, Settings, WorldState } from '../domain/types';
import { moveIsland, type MoveProblem } from '../domain/island/move';
import {
  addSkin,
  buyProblem,
  chooseSkins,
  chosenSkins,
  DEFAULT_EQUIPPED,
  equipSkin,
  equipTheme,
  grantFor,
  ownedCount,
  pickSpawnSkin,
  sanitizeEquipped,
  toggleSkin,
  unplacedBuildings,
  type BuyProblem,
  type EquipProblem,
} from '../domain/cosmetics/inventory';
import { content } from '../domain/content';
import { placementProblem, type PlaceProblem } from '../domain/build/placement';
import type { Tile } from '../domain/island/island';
import { balance } from '../../shared/balance/balance';
import { debitEntry, goldBalance, goldEntry, hasStarterGrant, InsufficientGoldError, LEDGER_REASON } from '../domain/economy/ledger';
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
import { animalTile, getOccupancy, repairPlacements, type Rotation } from '../domain/island/occupancy';
import { clamp, type Rng } from '../domain/random';
import { createBackup, type Backup } from '../domain/backup';
import type { StorageAdapter } from '../platform/storage';
import { createMemoryStorage } from '../platform/storage/memory';
import { callApi, RemoteError, type Provider, type RemotePort } from '../platform/remote';
import { isNewer, verifyPack } from '../domain/content/remote';
import { refreshCatalog } from '../domain/animals/catalog';
import type { ContentPack } from '../../shared/content/pack';
import type { ContentPackRow } from '../domain/types';
import { PUSH_CATEGORIES, type PushCategory } from '../../shared/rules/push';
import { parseDeepLink, type DeepLink } from '../../shared/rules/links';
import type { PushAdapter } from '../platform/push';
import type { ReportReason } from '../../shared/api/types';
import { createSocial, SOCIAL_EMPTY, type Outcome, type SocialSlice } from './social';

const fetchText = async (url: string) => (await fetch(url)).text();
/** An image as a data URL, so the stored pack renders offline. */
const fetchDataUrl = async (url: string) => {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};
import { ACCOUNT_OFF, createAccount, type AccountChoice, type AccountState } from './account';

export type View = 'home' | 'settings' | 'collection' | 'shop' | 'build';
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
  /** The backend (Phase 5); absent = local only, no accounts. */
  remote?: RemotePort | null;
  /** `features.remoteContent`: newer content packs are downloaded from the server (Step 5.8). */
  remoteContent?: boolean;
  /** Downloads for content packs (tests replace them). */
  fetchText?: (url: string) => Promise<string>;
  fetchDataUrl?: (url: string) => Promise<string>;
  /** Push notifications (Step 6.6); absent or unavailable on the web. */
  push?: PushAdapter;
  /** For `register_device`. */
  platformName?: 'web' | 'ios' | 'android';
  locale?: string;
  /** The device's IANA time zone (a new group's ranking week). */
  timeZone?: string;
}

export interface AppState extends SocialSlice {
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
  /** Islands left by island moves (F5). */
  islandHistory: IslandHistoryEntry[];
  /** The island-move sequence playing now (memory only; the move itself is already saved). */
  islandMove: IslandMoveSequence | null;
  /** Sign-in and sync state (Phase 5). */
  account: AccountState;
  /** Week the island flies the champion flag (Phase 8), from the server. */
  championWeek: string | null;
  /** Content pack version in use; changes when a downloaded pack is activated (Step 5.8). */
  contentVersion: string;
  /** The app was opened with a link (Step 6.5); the tab that handles its kind takes it with `takeLink`. */
  pendingLink: DeepLink | null;
  /** The one-line push explanation is showing (Step 6.6). */
  pushPrompt: boolean;

  init(): Promise<void>;
  /** Emails a sign-in code (Step 5.4). */
  requestSignInCode(email: string): Promise<void>;
  /** Signs in with the emailed code and links this device (first sign-in may ask `account.choice`). */
  verifySignInCode(email: string, code: string): Promise<void>;
  signInWithProvider(provider: Provider): Promise<void>;
  /** Which data to keep when both this device and the account have some (Step 5.7). */
  resolveAccountChoice(choice: AccountChoice): Promise<void>;
  cancelAccountChoice(): Promise<void>;
  /** Signs out; this device starts over with a fresh local island. */
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  /** Pulls changes from the server (no-op when signed out or focusing); `force` ignores the 5-minute spacing. */
  sync(force?: boolean): Promise<void>;
  /**
   * Checks for a newer content pack (Step 5.8; not during Focus), downloads it in the background,
   * verifies the checksum and keeps it; it is used from the next return to Home.
   */
  checkContent(): Promise<void>;
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
  /** Chooses only this owned skin (or `default`) for a species. Rejects with an `EquipError`. */
  equipSkin(speciesId: string, skinId: string): Promise<void>;
  /** Adds an owned skin to the species' choice (replacing Default alone), e.g. right after buying it. */
  addSkin(speciesId: string, skinId: string): Promise<void>;
  /** Turns a skin on or off in the species' choice; the last one stays (ADR-043). */
  toggleSkin(speciesId: string, skinId: string): Promise<void>;
  /** Sets the species' chosen skins, e.g. every owned one. */
  chooseSkins(speciesId: string, skinIds: readonly string[]): Promise<void>;
  /** Equips an owned block theme (or `default`). Rejects with an `EquipError`. */
  equipTheme(themeId: string): Promise<void>;
  /**
   * Places an owned, unplaced building, or moves / rotates a placed one (`movingId`), on Home only
   * (Step 3.11). Animals on its tiles walk to the nearest free tile, in the same write. Returns why it
   * does not fit, or null when placed.
   */
  placeBuilding(p: { defId: string; tile: Tile; rotation: Rotation; movingId?: string }): Promise<PlaceProblem | 'none_left' | 'not_idle' | 'offline' | null>;
  /** Puts a placed building back into the inventory. */
  storeBuilding(id: string): Promise<void>;
  /** A candidate seed for a new island (previews before moving). */
  rollIslandSeed(): number;
  /**
   * Moves to the island of `seed` (Step 4.1): spends the oldest Unicorn, re-places the animals, returns
   * the buildings, in one write; then starts the move sequence. Returns why not, or null.
   */
  moveIsland(seed: number): Promise<MoveProblem | 'offline' | null>;
  /** Ends (or skips) the move sequence. */
  finishIslandMove(): void;
  /** A link opened the app (web URL, universal / app link, tapped push). Ignored if it is not one of ours. */
  openLink(url: string): void;
  /** Hands the pending link to the screen that handles it, and clears it. */
  takeLink<K extends DeepLink['kind']>(kind: K): Extract<DeepLink, { kind: K }> | null;
  /**
   * The first social action (friend request, group join) calls this: signed in on a phone and never asked,
   * it shows the one-line push explanation (Step 6.6). Never at launch.
   */
  askPush(): void;
  /** The answer to the explanation; `allow` asks the system for permission and registers the device. */
  answerPush(allow: boolean): Promise<void>;
  /** Turns one push category on or off for this device. */
  setPushCategory(category: PushCategory, on: boolean): Promise<void>;

  // --- Phase 7: identity, friends, visits, presence, focus together (server data, signed in) ---
  /** Loads the Friends tab and friends' presence. */
  refreshSocial(): Promise<void>;
  /** Chooses or changes the name (the server assigns the tag). */
  setHandle(name: string): Promise<Outcome>;
  /** Sends a friend request to a typed `name#tag`. */
  addFriend(text: string): Promise<{ outcome: Outcome; status?: 'pending' | 'accepted' }>;
  respondFriend(userId: string, accept: boolean): Promise<Outcome>;
  cancelFriend(userId: string): Promise<Outcome>;
  removeFriend(userId: string): Promise<Outcome>;
  blockUser(userId: string): Promise<Outcome>;
  unblockUser(userId: string): Promise<Outcome>;
  reportUser(userId: string, reason: ReportReason, note: string, context: 'friends' | 'group' | 'visit'): Promise<Outcome>;
  /** Visit mode (Step 7.4): shows a friend's island. */
  visitIsland(userId: string): Promise<Outcome>;
  prefetchIsland(userId: string): void;
  leaveVisit(): void;
  /** Focus together (Step 7.7): a lobby with this device's focus length. */
  createRoom(invitees: string[]): Promise<Outcome>;
  joinRoom(roomId: string): Promise<Outcome>;
  leaveRoom(): Promise<void>;
  startRoom(): Promise<Outcome>;
  /** Refreshes the room; when the host has started it, this device starts its focus at the shared time. */
  pollRoom(): Promise<void>;

  // --- Phase 8: groups ---
  refreshGroup(): Promise<void>;
  /** A new group in this device's time zone. */
  createGroup(name: string): Promise<Outcome>;
  joinGroup(code: string): Promise<Outcome>;
  respondGroupInvite(inviteId: string, accept: boolean): Promise<Outcome>;
  inviteToGroup(userId: string): Promise<Outcome>;
  setGroupCode(action: 'regenerate' | 'disable' | 'enable'): Promise<Outcome>;
  renameGroup(name: string): Promise<Outcome>;
  leaveGroup(): Promise<Outcome>;
  removeMember(userId: string): Promise<Outcome>;
  transferGroup(userId: string): Promise<Outcome>;
  setGroupWar(enabled: boolean): Promise<Outcome>;
  disbandGroup(): Promise<Outcome>;
}

/** What the move sequence needs about the island left behind (Step 4.3). */
export interface IslandMoveSequence {
  oldWorld: WorldState;
  /** Animals that were on the old island, on their old tiles (the spent Unicorn included). */
  oldAnimals: PlacedAnimal[];
  oldBuildings: PlacedBuilding[];
  spentId: string;
}

/** Occupancy of the own island now: active animals and placed buildings. */
export function selectOccupancy(s: Pick<AppState, 'world' | 'animals' | 'placedBuildings'>) {
  return getOccupancy({
    seed: s.world.seed,
    islandLevel: islandLevel(s.animals),
    animals: s.animals.filter(isActive).map((a) => ({ id: a.id, tile: animalTile(a) })),
    buildings: s.placedBuildings.map((b) => ({ id: b.id, defId: b.defId, tile: { x: b.tileX, z: b.tileZ }, rotation: b.rotation })),
  });
}

export class BuyError extends Error {
  constructor(readonly problem: BuyProblem | 'offline') {
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
  pushAsked: false,
  pushCategories: Object.fromEntries(PUSH_CATEGORIES.map((c) => [c, true])) as Settings['pushCategories'],
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
    pushAsked: Boolean(merged.pushAsked),
    pushCategories: Object.fromEntries(PUSH_CATEGORIES.map((c) => [c, merged.pushCategories?.[c] !== false])) as Settings['pushCategories'],
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
  /** Content packs already merged into the registry, and a downloaded one waiting for Home. */
  const mergedPacks = new Set<string>();
  let pendingPack: ContentPackRow | null = null;

  function mergePack(row: ContentPackRow): void {
    if (mergedPacks.has(row.contentVersion)) return;
    const pack = JSON.parse(row.json) as ContentPack;
    content.merge(pack.atlas ? { ...pack, atlas: { ...pack.atlas, image: row.atlas } } : pack);
    mergedPacks.add(row.contentVersion);
    refreshCatalog();
  }

  /** Uses a downloaded pack from now on (on the way Home, so nothing changes mid-break). */
  function activatePendingPack(): void {
    if (!pendingPack) return;
    mergePack(pendingPack);
    pendingPack = null;
    store.setState({ contentVersion: content.contentVersion });
  }

  const account = createAccount({
    remote: deps.remote ?? null,
    storage: () => deps.storage,
    now: () => deps.now(),
    uuid: () => deps.uuid(),
    commit: (c) => commit(c),
    synced: () => store.getState(),
    set: (patch) => store.setState(patch as Partial<AppState>),
    memoryOnly,
    reload: async () => store.setState(await hydrate(false)),
    async onReward(pending, animal) {
      const { phase, sessions } = store.getState();
      if (phase.kind !== 'break' || phase.awaiting?.requestId !== pending.requestId) return; // already left the break
      const next = startBreak(phase.startedAt, phase.plannedMs, animal?.id);
      await commit({ phase: next });
      const session = sessions.find((s) => s.id === pending.sessionId);
      store.setState({ phase: next, revealPending: animal?.id ?? null, ...(session && animal && { sessions: sessions.map((s) => (s.id === session.id ? { ...s, rewardAnimalId: animal.id } : s)) }) });
    },
  });

  const social = createSocial({
    account,
    now: () => deps.now(),
    uuid: () => deps.uuid(),
    get: () => store.getState(),
    set: (patch) => store.setState(patch),
    askPush: () => store.getState().askPush(),
  });

  /**
   * Push registration (Step 6.6): `ask` asks the system for permission (after the explanation); otherwise
   * only a device that already allowed push is refreshed (token, categories, last seen).
   */
  async function registerDevice(ask: boolean): Promise<void> {
    const push = deps.push;
    if (!push?.available || !account.linked) return;
    try {
      const token = ask ? await push.register() : await push.token();
      if (!token) return;
      const { pushCategories } = store.getState().settings;
      await account.registerDevice({ platform: deps.platformName ?? 'web', pushToken: token, appVersion: deps.clientVersion ?? '0.0.0', locale: deps.locale ?? 'en', categories: pushCategories });
    } catch {
      // Offline or not configured: the next start tries again.
    }
  }

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

    // Downloaded content packs first: owned items and new animals must be known before anything else.
    for (const row of loaded.contentPacks ?? []) mergePack(row);
    const resetMap = devSwitches && deps.resetMap;
    const settings = sanitizeSettings(loaded.settings);
    let world = loaded.world;
    let stored = loaded.animals;
    if (resetMap || !world) {
      world = { seed: Math.floor(deps.rng() * 2 ** 31), blockThemeId: DEFAULT_BLOCK_THEME };
      if (resetMap) stored = [];
      await deps.storage.resetWorld(world).catch(() => undefined);
    }

    const dummy = devSwitches ? deps.dummy : undefined;
    const cosmetics = [...loaded.cosmetics, ...(dummy?.cosmetics ?? [])];
    // ponytail: placed buildings beyond the owned count (e.g. placed with dummy items) are ignored, not deleted.
    const placedBuildings = loaded.placedBuildings.filter((b, i, all) => all.slice(0, i + 1).filter((x) => x.defId === b.defId).length <= ownedCount(cosmetics, b.defId));
    const occupied = () => placedBuildings.map((b) => ({ id: b.id, defId: b.defId, tile: { x: b.tileX, z: b.tileZ }, rotation: b.rotation }));

    // Save repair (Step 0.7): active animals on water, camp, reserved or building tiles move to the nearest free tile.
    const repaired = repairPlacements({ seed: world.seed, islandLevel: islandLevel(stored), buildings: occupied() }, stored.filter(isActive));
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
      const tile = pickNewAnimalTile(world.seed, animals, deps.rng, occupied());
      if (!tile) continue;
      const animal = newPlacedAnimal(deps.uuid(), species, tile, acquiredAt, 'test-mode');
      memoryOnly.add(animal.id);
      animals.push(animal);
    }

    let ledger = loaded.ledger;
    const accountState = account.restore(loaded.account, ledger);
    // Signed in, gold comes from the server (it grants its own starter gold).
    if (deps.economy && !account.linked && !hasStarterGrant(ledger)) {
      const starter = goldEntry(deps.uuid(), deps.now(), balance.economy.starterGold, LEDGER_REASON.starter, null);
      await commit({ ledgerAdd: [starter] });
      ledger = [...ledger, starter];
    }

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
      islandHistory: loaded.islandHistory,
      islandMove: null,
      account: accountState,
      contentVersion: content.contentVersion,
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

  async function saveEquipped(next: Equipped | EquipProblem): Promise<void> {
    if (typeof next === 'string') throw new EquipError(next);
    await commit({ equipped: next });
    store.setState({ equipped: next });
    if (account.linked) void account.queue({ kind: 'equip', equipped: next });
  }

  /** Sends the whole building layout to the server; the answer (stored layout, moved animals) arrives as a delta. */
  async function applyLayoutRemote(buildings: PlacedBuilding[]): Promise<PlaceProblem | 'offline' | null> {
    try {
      await account.call('apply_layout', { buildings: buildings.filter((b) => !memoryOnly.has(b.id)) }, { requestId: deps.uuid() });
      return null;
    } catch (e) {
      return e instanceof RemoteError && e.code === 'layout_invalid' ? 'occupied' : 'offline';
    }
  }

  /** Server answers to a purchase, as the errors the shop already handles. */
  function buyErrorOf(e: unknown, defId: string): Error {
    if (!(e instanceof RemoteError)) return e as Error;
    if (e.code === 'insufficient_gold') return new InsufficientGoldError((content.get(defId) as { price?: number })?.price ?? 0, store.getState().gold);
    if (e.code === 'already_owned') return new BuyError('owned');
    if (e.code === 'species_not_found') return new BuyError('species_not_found');
    if (e.code === 'item_unavailable') return new BuyError('not_for_sale');
    return new BuyError('offline');
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
    islandHistory: [],
    islandMove: null,
    account: ACCOUNT_OFF,
    championWeek: null,
    contentVersion: content.contentVersion,
    pendingLink: null,
    pushPrompt: false,
    ...SOCIAL_EMPTY,

    refreshSocial: () => social.refresh(),
    setHandle: (name) => social.setHandle(name),
    addFriend: (text) => social.addFriend(text),
    respondFriend: (userId, accept) => social.respond(userId, accept),
    cancelFriend: (userId) => social.cancel(userId),
    removeFriend: (userId) => social.remove(userId),
    blockUser: (userId) => social.block(userId),
    unblockUser: (userId) => social.unblock(userId),
    reportUser: (userId, reason, note, context) => social.report(userId, reason, note, context),
    visitIsland: (userId) => social.visit(userId),
    prefetchIsland: (userId) => social.prefetch(userId),
    leaveVisit: () => social.leaveVisit(),
    createRoom: (invitees) => social.createRoom(minutesToMs(get().settings.focusMinutes), invitees),
    joinRoom: (roomId) => social.joinRoom(roomId),
    leaveRoom: () => social.leaveRoom(),
    startRoom: async () => {
      const outcome = await social.startRoom();
      if (!outcome) await get().pollRoom();
      return outcome;
    },

    refreshGroup: () => social.refreshGroup(),
    createGroup: (name) => social.groupAct('group_create', { name, timezone: deps.timeZone ?? 'UTC' }, { social: true }),
    joinGroup: (code) => social.groupAct('group_join', { code }, { social: true }),
    respondGroupInvite: (inviteId, accept) => social.groupAct('group_invite_respond', { inviteId, accept }, { social: accept }),
    inviteToGroup: (userId) => social.groupAct('group_invite', { userId }),
    setGroupCode: (action) => social.groupAct('group_code', { action }),
    renameGroup: (name) => social.groupAct('group_rename', { name }),
    leaveGroup: () => social.groupAct('group_leave', {}),
    removeMember: (userId) => social.groupAct('group_remove_member', { userId }),
    transferGroup: (userId) => social.groupAct('group_transfer', { userId }),
    setGroupWar: (enabled) => social.groupAct('group_set_war', { enabled }),
    disbandGroup: () => social.groupAct('group_disband', {}),

    async pollRoom() {
      const room = await social.pollRoom();
      const me = room?.participants.find((p) => p.person.userId === get().account.userId);
      if (!room || room.status !== 'started' || me?.state !== 'joined' || get().phase.kind === 'focus') return;
      // The host started: this device's focus starts at the room's server time (Step 7.7).
      const id = deps.uuid();
      try {
        const { session: remote } = await account.call('start_session', { sessionId: id, plannedMs: room.plannedMs, roomId: room.id }, { requestId: `start-${id}` });
        const startedAt = remote.startedAt - account.serverOffset;
        const session: FocusSession = { ...remote, startedAt };
        const next = startFocus(startedAt, remote.plannedFocusMs, id);
        await commit({ session, phase: next });
        set({ phase: next, sessions: [...get().sessions, session], revealPending: null, view: 'home', activeTab: 'island', visit: null });
      } catch {
        // Too late or closed: the lobby shows it on the next poll.
      }
    },

    async init() {
      set(await hydrate(true));
      await account.completeRedirect().catch(() => undefined);
      await get().applyExpirations();
      void get().checkContent();
      void registerDevice(false);
    },

    openLink(url) {
      const link = parseDeepLink(url);
      if (link) set({ pendingLink: link });
    },

    takeLink(kind) {
      const link = get().pendingLink;
      if (link?.kind !== kind) return null;
      set({ pendingLink: null });
      return link as Extract<DeepLink, { kind: typeof kind }>;
    },

    askPush() {
      if (!deps.push?.available || !account.linked || get().settings.pushAsked) return;
      set({ pushPrompt: true });
    },

    async answerPush(allow) {
      set({ pushPrompt: false });
      await get().updateSettings({ pushAsked: true });
      if (allow) await registerDevice(true);
    },

    async setPushCategory(category, on) {
      // Touching a toggle is a deliberate choice, so it may ask (the system asks once; later it just answers).
      await get().updateSettings({ pushAsked: true, pushCategories: { ...get().settings.pushCategories, [category]: on } });
      await registerDevice(true);
    },

    async checkContent() {
      const remote = deps.remote;
      if (!deps.remoteContent || !remote || get().phase.kind === 'focus') return;
      try {
        const { data } = await callApi(remote, 'get_content_manifest', { clientVersion: deps.clientVersion ?? '0.0.0' }, { retries: 0 });
        const m = data.manifest;
        if (!m || !isNewer(m.contentVersion, content.contentVersion) || pendingPack?.contentVersion === m.contentVersion) return;
        const text = await (deps.fetchText ?? fetchText)(m.packUrl);
        const pack = await verifyPack(text, m.checksum);
        if (typeof pack === 'string') {
          console.warn(`Sift: content pack ${m.contentVersion} rejected (${pack}).`);
          return;
        }
        const atlas = pack.atlas ? await (deps.fetchDataUrl ?? fetchDataUrl)(m.atlasUrl) : '';
        const row: ContentPackRow = { contentVersion: m.contentVersion, checksum: m.checksum, json: text, atlas, fetchedAt: deps.now() };
        await commit({ contentPack: row });
        pendingPack = row;
        if (get().phase.kind === 'idle' && get().view === 'home') activatePendingPack();
      } catch (e) {
        console.warn('Sift: content check failed; trying again later.', e);
      }
    },

    requestSignInCode: (email) => account.requestCode(email),
    verifySignInCode: (email, code) => account.verifyCode(email, code).then(() => registerDevice(false)),
    signInWithProvider: (provider) => account.signInWithProvider(provider).then(() => registerDevice(false)),
    resolveAccountChoice: (choice) => account.resolveChoice(choice).then(() => registerDevice(false)),
    cancelAccountChoice: () => account.cancelChoice(),
    signOut: () => account.signOut().then(() => set(SOCIAL_EMPTY)),
    deleteAccount: () => account.deleteAccount().then(() => set(SOCIAL_EMPTY)),
    sync: (force) => account.sync(force),

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
      // Signed in: the server confirms the start in the background (Step 5.5); offline, the session stays
      // unverified and is rewarded locally. Nothing shows during Focus either way.
      if (account.linked) {
        void account.confirmStart(session).then(async (ok) => {
          const current = get().sessions.find((s) => s.id === session.id);
          if (!ok || !current || current.status !== 'running') return;
          const verified = { ...current, verified: true };
          await commit({ session: verified });
          set({ sessions: get().sessions.map((s) => (s.id === session.id ? verified : s)) });
        });
      }
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

      // Signed in with a verified start: the server rolls the reward (Step 5.5). Offline, the break shows
      // "Revealing when you're back online…" and the call is retried with the same request id.
      if (account.linked && session.verified) {
        const pending = { sessionId: session.id, requestId: deps.uuid(), endedAt: now };
        const waiting: StoredPhase = { ...startBreak(now, minutesToMs(settings.breakMinutes)), awaiting: pending } as StoredPhase;
        await commit({ session, phase: waiting });
        set({ phase: waiting, sessions: sessions.map((s) => (s.id === session.id ? session : s)), revealPending: null });
        const out = await account.endVerified(pending);
        if (out !== 'waiting') {
          const p = get().phase;
          if (p.kind === 'break' && p.awaiting?.requestId === pending.requestId) {
            const next = startBreak(p.startedAt, p.plannedMs, out.animal?.id);
            await commit({ phase: next });
            set({ phase: next, revealPending: out.animal?.id ?? null });
          }
        }
        return;
      }

      let animal: PlacedAnimal | undefined;
      const species = rollReward(effective, deps.rng);
      if (species) {
        const buildings = get().placedBuildings.map((b) => ({ id: b.id, defId: b.defId, tile: { x: b.tileX, z: b.tileZ }, rotation: b.rotation }));
        const tile = pickNewAnimalTile(world.seed, animals, deps.rng, buildings);
        if (tile) {
          animal = newPlacedAnimal(deps.uuid(), species, tile, now, session.id);
          // With several chosen skins the new animal wears one of them at random, for good (ADR-043).
          if (chosenSkins(get().equipped, species.id).length > 1) animal.skinId = pickSpawnSkin(get().equipped, species.id, deps.rng);
          // Signed in but started offline (§9 Q16): kept, but out of score and war, and uploaded later.
          if (account.linked) animal.verified = false;
          session.rewardAnimalId = animal.id;
        }
      }

      const next = startBreak(now, minutesToMs(settings.breakMinutes), animal?.id);
      await commit(animal ? { session, animal, phase: next } : { session, phase: next });
      if (account.linked) void account.queue({ kind: 'local_session', session, animal: animal ?? null });
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
      if (account.linked) {
        if (session.verified) void account.abandonVerified(session.id, now);
        else void account.queue({ kind: 'local_session', session, animal: null });
      }
      await get().applyExpirations();
    },

    async goHome() {
      const { phase } = get();
      if (phase.kind !== 'break') return;
      await commit({ phase: IDLE });
      // A focus-together room ends with the break (its strip is shown there).
      set({ phase: IDLE, revealPending: null, view: 'home', room: null });
      activatePendingPack();
      // Signed in: returning Home always pulls (Step 5.6).
      if (account.linked) await account.sync(true);
      else await get().applyExpirations();
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
      const before = get().settings;
      const settings = sanitizeSettings({ ...before, ...patch });
      set({ settings });
      await deps.storage.saveSettings(settings).catch((e) => console.warn('Sift: could not save settings.', e));
      // "Show when I'm focusing" lives on the server too (Step 7.6).
      if (settings.showFocusPresence !== before.showFocusPresence) void account.queue({ kind: 'presence_setting', showPresence: settings.showFocusPresence });
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
      if (account.linked) void account.queue({ kind: 'dismiss_notice', id });
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
      if (account.linked) {
        // Signed in, the server spends the gold and grants the item (Step 5.5); it needs a connection.
        await account.call('purchase', { defId }, { requestId: deps.uuid() }).catch((e) => {
          throw buyErrorOf(e, defId);
        });
        return;
      }
      const item = content.get(defId) as Parameters<typeof grantFor>[0];
      await get().spendGold(item.price!, LEDGER_REASON.purchase, defId, grantFor(item, deps.uuid(), deps.now()));
    },

    equipSkin: (speciesId, skinId) => saveEquipped(equipSkin(get().equipped, get().cosmetics, speciesId, skinId)),
    addSkin: (speciesId, skinId) => saveEquipped(addSkin(get().equipped, get().cosmetics, speciesId, skinId)),
    toggleSkin: (speciesId, skinId) => saveEquipped(toggleSkin(get().equipped, get().cosmetics, speciesId, skinId)),
    chooseSkins: (speciesId, skinIds) => saveEquipped(chooseSkins(get().equipped, get().cosmetics, speciesId, skinIds)),
    equipTheme: (themeId) => saveEquipped(equipTheme(get().equipped, get().cosmetics, themeId)),

    async placeBuilding({ defId, tile, rotation, movingId }) {
      const s = get();
      if (s.phase.kind !== 'idle') return 'not_idle';
      const moving = movingId ? s.placedBuildings.find((b) => b.id === movingId) : undefined;
      if (!moving && (unplacedBuildings(s.cosmetics, s.placedBuildings).get(defId) ?? 0) < 1) return 'none_left';
      const problem = placementProblem(selectOccupancy(s), { defId, tile, rotation, minFreeTiles: balance.build.minFreeTiles, ...(moving && { movingId: moving.id }) });
      if (problem) return problem;

      const building: PlacedBuilding = moving
        ? { ...moving, tileX: tile.x, tileZ: tile.z, rotation }
        : { id: deps.uuid(), defId, tileX: tile.x, tileZ: tile.z, rotation, placedAt: deps.now() };
      const buildings = [...s.placedBuildings.filter((b) => b.id !== building.id), building];
      // Signed in, the server validates and stores the layout and moves the animals (Step 5.5).
      if (account.linked) return applyLayoutRemote(buildings);
      // Animals on the new tiles walk to the nearest free tile (save repair does exactly that).
      const moved = repairPlacements(
        { seed: s.world.seed, islandLevel: islandLevel(s.animals), buildings: buildings.map((b) => ({ id: b.id, defId: b.defId, tile: { x: b.tileX, z: b.tileZ }, rotation: b.rotation })) },
        s.animals.filter(isActive),
      );
      await commit({
        ...(!memoryOnly.has(building.id) && { buildingsPut: [building] }),
        animals: moved.filter((a) => !memoryOnly.has(a.id)),
      });
      const byId = new Map(moved.map((a) => [a.id, a]));
      set({ placedBuildings: buildings, animals: get().animals.map((a) => byId.get(a.id) ?? a) });
      return null;
    },

    async storeBuilding(id) {
      if (!get().placedBuildings.some((b) => b.id === id)) return;
      if (account.linked) {
        await applyLayoutRemote(get().placedBuildings.filter((b) => b.id !== id));
        return;
      }
      if (!memoryOnly.has(id)) await commit({ buildingsRemove: [id] });
      set({ placedBuildings: get().placedBuildings.filter((b) => b.id !== id) });
    },

    rollIslandSeed() {
      let seed: number;
      do seed = Math.floor(deps.rng() * 2 ** 31);
      while (seed === get().world.seed);
      return seed;
    },

    async moveIsland(seed) {
      const s = get();
      const out = moveIsland({
        phase: s.phase,
        world: s.world,
        animals: s.animals,
        buildings: s.placedBuildings,
        history: s.islandHistory,
        newSeed: seed,
        now: deps.now(),
        rng: deps.rng,
        historyId: deps.uuid(),
      });
      if (typeof out === 'string') return out;
      if (account.linked) {
        // Signed in, the server moves the island (same rule); the sequence plays from the saved result.
        const before = { oldWorld: s.world, oldAnimals: s.animals.filter(isActive), oldBuildings: s.placedBuildings, spentId: out.spent.id };
        try {
          await account.call('move_island', { seed }, { requestId: deps.uuid() });
        } catch (e) {
          return e instanceof RemoteError && (e.code === 'no_unicorn' || e.code === 'not_idle') ? e.code : 'offline';
        }
        set({ islandMove: before });
        return null;
      }
      await commit({
        world: out.world,
        islandHistoryAdd: [out.history],
        animals: out.animals.filter((a) => !memoryOnly.has(a.id)),
        buildingsRemove: out.buildingsRemoved.filter((id) => !memoryOnly.has(id)),
      });
      const changed = new Map(out.animals.map((a) => [a.id, a]));
      set({
        world: out.world,
        islandHistory: [...s.islandHistory, out.history],
        animals: s.animals.map((a) => changed.get(a.id) ?? a),
        placedBuildings: [],
        islandMove: { oldWorld: s.world, oldAnimals: s.animals.filter(isActive), oldBuildings: s.placedBuildings, spentId: out.spent.id },
      });
      return null;
    },

    finishIslandMove() {
      if (get().islandMove) set({ islandMove: null });
    },

    applyExpirations() {
      // Signed in, the server settles expirations; a pull brings them (every 5 minutes at most from here).
      if (account.linked) return account.sync();
      // One run at a time, so a timer tick and a phase change never credit the same animal twice.
      expiring ??= expire().finally(() => (expiring = null));
      return expiring;
    },
  }));
  return store;
}

export type AppStore = ReturnType<typeof createAppStore>;

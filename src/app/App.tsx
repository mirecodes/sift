import { useEffect, useMemo, useRef, useState } from 'react';
import { buildIslandModel } from '../domain/island/model';
import { config } from '../domain/config';
import { pendingDepartures } from '../domain/inbox/inbox';
import { goldPileLevel as goldPileLevelOf } from '../domain/economy/ledger';
import { balance } from '../../shared/balance/balance';
import { appStore, selectIslandLevel, selectVisibleAnimals, useApp, type Tab } from '../store';
import { platform } from '../platform';
import { clearContentGeometry } from '../world/voxel/geometry';
import { AccountChoiceSheet, OutdatedScreen } from '../screens/account/AccountChoiceSheet';
import { PushPromptSheet } from '../screens/account/PushPromptSheet';
import { bindPhaseEffects } from './phaseEffects';
import { usePrefersReducedMotion } from '../ui/hooks';
import { strings } from '../ui/strings';
import { FriendsIcon, GroupIcon, IslandIcon, StatsIcon } from '../ui/components/Icons';
import { TabBar, type TabItem } from '../ui/components/TabBar';
import { BreakPill } from '../screens/break/BreakPill';
import { BreakScreen } from '../screens/break/BreakScreen';
import { CollectionScreen } from '../screens/collection/CollectionScreen';
import { FocusScreen } from '../screens/focus/FocusScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { ShopScreen } from '../screens/shop/ShopScreen';
import { BuildScreen } from '../screens/build/BuildScreen';
import { useBuildUi } from '../screens/build/buildState';
import { BuildIslandLayer } from './BuildIslandLayer';
import { StatsScreen } from '../screens/stats/StatsScreen';
import { TabPage } from '../screens/TabPage';
import { Scene, type SceneIsland, type SceneLayout } from '../world/Scene';
import type { WorldMode } from '../world/types';
import { IslandMoveSequence, type IslandMoveRefs } from '../world/sequences/IslandMove';
import { REVEAL_RISE } from '../world/sequences/islandMove';
import { MoveScreen } from '../screens/home/MoveScreen';
import type { IslandMoveSequence as MoveState } from '../store';
import { devSecondIsland, DEV_TWO_ISLANDS } from './devTwoIslands';
import { runtimeConfig } from './runtimeConfig';
import styles from './App.module.css';

const { features } = runtimeConfig;
/** Island is always there; the others appear with their feature flag. One tab = no tab bar. */
const TABS: TabItem<Tab>[] = [
  { id: 'island', label: strings.tabs.island, icon: <IslandIcon /> },
  ...(features.stats ? [{ id: 'stats' as const, label: strings.tabs.stats, icon: <StatsIcon /> }] : []),
  ...(features.friends ? [{ id: 'friends' as const, label: strings.tabs.friends, icon: <FriendsIcon /> }] : []),
  ...(features.groups ? [{ id: 'group' as const, label: strings.tabs.group, icon: <GroupIcon /> }] : []),
];

/**
 * Refs shared by the islands and the move sequence. Reset when a move starts, before the first frame,
 * so the new island starts below its place instead of flashing in.
 */
function useIslandMoveRefs(move: MoveState | null): IslandMoveRefs {
  const refs = useRef<IslandMoveRefs>({ oldLift: { current: 0 }, newLift: { current: 0 }, oldBob: { current: 0 }, newBob: { current: 0 }, pan: { current: 0 } });
  const seen = useRef<MoveState | null>(null);
  if (move !== seen.current) {
    seen.current = move;
    const r = refs.current;
    r.oldLift.current = 0;
    r.newLift.current = move ? REVEAL_RISE : 0;
    r.pan.current = 0;
  }
  return refs.current;
}

export function App() {
  const ready = useApp((s) => s.ready);
  const phase = useApp((s) => s.phase);
  const view = useApp((s) => s.view);
  const activeTab = useApp((s) => s.activeTab);
  const setTab = useApp((s) => s.setTab);
  const world = useApp((s) => s.world);
  const allAnimals = useApp((s) => s.animals);
  const revealPending = useApp((s) => s.revealPending);
  const islandLevel = useApp((s) => selectIslandLevel(s));
  const theme = useApp((s) => s.settings.theme);
  const inbox = useApp((s) => s.inbox);
  const gold = useApp((s) => s.gold);
  const equipped = useApp((s) => s.equipped);
  const placedBuildings = useApp((s) => s.placedBuildings);
  const reducedMotion = usePrefersReducedMotion();
  const building = features.cosmetics && phase.kind === 'idle' && view === 'build';
  const movingId = useBuildUi((s) => (building ? s.placing?.movingId : undefined));
  const islandMove = useApp((s) => s.islandMove);
  const accountChoice = useApp((s) => s.account.choice !== null);
  const outdated = useApp((s) => s.account.outdated);
  const pushPrompt = useApp((s) => s.pushPrompt);
  const finishIslandMove = useApp((s) => s.finishIslandMove);
  const moveRefs = useIslandMoveRefs(islandMove);
  const moving = islandMove !== null && !reducedMotion;
  const [crossfade, setCrossfade] = useState(0);

  // Reduced motion: no sequence, the new island fades in (Step 4.3).
  useEffect(() => {
    if (islandMove && reducedMotion) {
      finishIslandMove();
      setCrossfade((n) => n + 1);
    }
  }, [islandMove, reducedMotion, finishIslandMove]);

  // Overtime and break-over share the render mode of their base phase, so no clock is needed here.
  const islands = useMemo(() => {
    const { leaving, departing, heldGold } = pendingDepartures(inbox, phase);
    const animals = selectVisibleAnimals({ animals: allAnimals, revealPending }, leaving);
    // The pile shows the gold the user has been told about (Step 2.4).
    const goldPileLevel = features.economy ? goldPileLevelOf(gold - heldGold, balance.economy.pileThresholds) : 0;
    // Skins, theme and buildings show only with the cosmetics feature (Phase 3). A building being moved
    // in build mode is drawn as its ghost only.
    const buildings = placedBuildings.filter((b) => b.id !== movingId);
    const cosmetics = features.cosmetics ? { equipped, buildings } : {};
    const base = { islandLevel, leaving, departing, goldPileLevel, showExpiry: features.economy, ...cosmetics };
    if (moving && islandMove) {
      // Island move: both islands without their animals; the sequence draws the animals crossing.
      const old = buildIslandModel({ ...base, world: islandMove.oldWorld, animals: [], ...(features.cosmetics && { buildings: islandMove.oldBuildings }) });
      const next = buildIslandModel({ ...base, world, animals: [] });
      return [
        { model: old, mode: 'move' as const, motion: { lift: moveRefs.oldLift, bobY: moveRefs.oldBob, calm: true } },
        { model: next, mode: 'own' as const, motion: { lift: moveRefs.newLift, bobY: moveRefs.newBob, calm: true } },
      ];
    }
    const own = buildIslandModel({ ...base, world, animals });
    const list: SceneIsland[] = [{ model: own, mode: 'own' }];
    if (DEV_TWO_ISLANDS !== null) list.push({ model: devSecondIsland(own, DEV_TWO_ISLANDS), mode: 'visit' });
    return list;
  }, [world, islandLevel, allAnimals, revealPending, inbox, phase, gold, equipped, placedBuildings, movingId, moving, islandMove, moveRefs]);

  // Who crosses the bridge, from which old tile to which new one, in the skin they wear.
  const crossing = useMemo(() => {
    if (!moving || !islandMove) return null;
    const look = buildIslandModel({ world: islandMove.oldWorld, islandLevel, animals: islandMove.oldAnimals, ...(features.cosmetics && { equipped }) }).animals;
    const now = new Map(allAnimals.map((a) => [a.id, a]));
    const movers = look.filter((a) => a.id !== islandMove.spentId && now.get(a.id)?.status === 'active').map((a) => {
      const after = now.get(a.id)!;
      return { id: a.id, speciesId: a.speciesId, skinId: a.skinId, from: a.tile, to: { x: after.tileX, z: after.tileZ } };
    });
    const u = look.find((a) => a.id === islandMove.spentId);
    return { movers, unicorn: u ? { id: u.id, speciesId: u.speciesId, skinId: u.skinId, from: u.tile } : null };
    // Fixed for the sequence: later changes (a departure) do not re-plan it.
  }, [moving, islandMove]);

  const focusing = phase.kind === 'focus';
  const tab = focusing || !TABS.some((t) => t.id === activeTab) ? 'island' : activeTab;
  // The tab bar is hidden on Focus (focus rule) and on the Island tab's Settings and Collection pages.
  const showTabs = ready && TABS.length > 1 && !focusing && !moving && !(tab === 'island' && phase.kind === 'idle' && view !== 'home');
  useEffect(() => {
    document.documentElement.toggleAttribute('data-tabs', showTabs);
  }, [showTabs]);

  // Expiry check every minute while not focusing (start and phase changes are handled in the store).
  // Signed in, the same tick pulls from the server at most every 5 minutes (Step 5.6).
  const signedIn = useApp((s) => s.account.status === 'signedIn');
  useEffect(() => {
    if (!ready || focusing || (!features.economy && !signedIn)) return;
    const id = setInterval(() => void appStore.getState().applyExpirations(), config.ui.expiryCheckMs);
    return () => clearInterval(id);
  }, [ready, focusing, signedIn]);

  // App resume (foreground or back online): pull at once and look for new content, never during Focus (the store checks).
  useEffect(
    () =>
      platform.lifecycle.onResume(() => {
        if (signedIn) void appStore.getState().sync(true);
        void appStore.getState().checkContent();
      }),
    [signedIn],
  );

  // Native timer notifications and lock-screen progress follow the phase (Steps 6.3, 6.8).
  useEffect(() => bindPhaseEffects(appStore, platform, { liveProgress: features.liveProgress }), []);

  // Deep links (Step 6.5): the URL the app was opened with, universal / app links, tapped pushes.
  useEffect(() => {
    const open = (url: string) => appStore.getState().openLink(url);
    const offLinks = platform.links.onOpen(open);
    const offPush = platform.push.onOpen(open);
    return () => {
      offLinks();
      offPush();
    };
  }, []);

  // A new content pack is in use (Step 5.8): rebuild cached meshes with its models and colors.
  const contentVersion = useApp((s) => s.contentVersion);
  const firstContent = useRef(contentVersion);
  useEffect(() => {
    if (contentVersion !== firstContent.current) clearContentGeometry();
  }, [contentVersion]);

  if (!ready) return <div className={styles.blank} />;

  // Covered tabs pause the canvas (frameloop `never`) but keep it mounted (§2.10).
  let mode: WorldMode;
  let screen: JSX.Element;
  if (focusing) {
    mode = 'focus';
    screen = <FocusScreen />;
  } else if (moving) {
    mode = 'sequence';
    screen = <MoveScreen />;
  } else if (tab === 'stats') {
    mode = 'paused';
    screen = <StatsScreen />;
  } else if (tab === 'friends' || tab === 'group') {
    mode = 'paused';
    screen = <TabPage title={strings.tabs[tab]} />;
  } else if (phase.kind === 'break') {
    mode = 'break';
    screen = <BreakScreen />;
  } else if (view === 'settings') {
    mode = 'paused';
    screen = <SettingsScreen />;
  } else if (view === 'collection') {
    mode = 'paused';
    screen = <CollectionScreen />;
  } else if (view === 'shop' && features.cosmetics) {
    mode = 'paused';
    screen = <ShopScreen />;
  } else if (building) {
    mode = 'home';
    screen = <BuildScreen />;
  } else {
    mode = 'home';
    screen = <HomeScreen />;
  }

  return (
    <>
      <Scene
        mode={mode}
        islands={islands}
        reducedMotion={reducedMotion}
        theme={theme}
        {...(crossing && {
          pan: moveRefs.pan,
          overlay: ({ positions }: SceneLayout) => (
            <IslandMoveSequence
              oldIsland={{ seed: islandMove!.oldWorld.seed, level: islandLevel }}
              newIsland={{ seed: world.seed, level: islandLevel }}
              movers={crossing.movers}
              unicorn={crossing.unicorn}
              positions={positions}
              refs={moveRefs}
              onDone={finishIslandMove}
            />
          ),
        })}
      >
        {building && <BuildIslandLayer />}
      </Scene>
      {screen}
      {crossfade > 0 && <div key={crossfade} className="scene-crossfade" aria-hidden="true" />}
      {accountChoice && !focusing && <AccountChoiceSheet />}
      {outdated && <OutdatedScreen />}
      {pushPrompt && !focusing && <PushPromptSheet />}
      {showTabs && phase.kind === 'break' && tab !== 'island' && <BreakPill />}
      {showTabs && <TabBar tabs={TABS} active={tab} onSelect={setTab} label={strings.aria.tabs} />}
    </>
  );
}

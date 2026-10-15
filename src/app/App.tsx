import { useEffect, useMemo } from 'react';
import { buildIslandModel, type IslandMode, type IslandModel } from '../domain/island/model';
import { config } from '../domain/config';
import { pendingDepartures } from '../domain/inbox/inbox';
import { goldPileLevel as goldPileLevelOf } from '../domain/economy/ledger';
import { balance } from '../../shared/balance/balance';
import { appStore, selectIslandLevel, selectVisibleAnimals, useApp, type Tab } from '../store';
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
import { Scene } from '../world/Scene';
import type { WorldMode } from '../world/types';
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
    const own = buildIslandModel({ world, islandLevel, animals, leaving, departing, goldPileLevel, showExpiry: features.economy, ...cosmetics });
    const list: { model: IslandModel; mode: IslandMode }[] = [{ model: own, mode: 'own' }];
    if (DEV_TWO_ISLANDS !== null) list.push({ model: devSecondIsland(own, DEV_TWO_ISLANDS), mode: 'visit' });
    return list;
  }, [world, islandLevel, allAnimals, revealPending, inbox, phase, gold, equipped, placedBuildings, movingId]);

  const focusing = phase.kind === 'focus';
  const tab = focusing || !TABS.some((t) => t.id === activeTab) ? 'island' : activeTab;
  // The tab bar is hidden on Focus (focus rule) and on the Island tab's Settings and Collection pages.
  const showTabs = ready && TABS.length > 1 && !focusing && !(tab === 'island' && phase.kind === 'idle' && view !== 'home');
  useEffect(() => {
    document.documentElement.toggleAttribute('data-tabs', showTabs);
  }, [showTabs]);

  // Expiry check every minute while not focusing (start and phase changes are handled in the store).
  useEffect(() => {
    if (!ready || focusing || !features.economy) return;
    const id = setInterval(() => void appStore.getState().applyExpirations(), config.ui.expiryCheckMs);
    return () => clearInterval(id);
  }, [ready, focusing]);

  if (!ready) return <div className={styles.blank} />;

  // Covered tabs pause the canvas (frameloop `never`) but keep it mounted (§2.10).
  let mode: WorldMode;
  let screen: JSX.Element;
  if (focusing) {
    mode = 'focus';
    screen = <FocusScreen />;
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
      <Scene mode={mode} islands={islands} reducedMotion={reducedMotion} theme={theme}>
        {building && <BuildIslandLayer />}
      </Scene>
      {screen}
      {showTabs && phase.kind === 'break' && tab !== 'island' && <BreakPill />}
      {showTabs && <TabBar tabs={TABS} active={tab} onSelect={setTab} label={strings.aria.tabs} />}
    </>
  );
}

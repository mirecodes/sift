import { useEffect, useMemo } from 'react';
import { buildIslandModel, type IslandMode, type IslandModel } from '../domain/island/model';
import { selectIslandLevel, selectVisibleAnimals, useApp, type Tab } from '../store';
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
  const reducedMotion = usePrefersReducedMotion();

  // Overtime and break-over share the render mode of their base phase, so no clock is needed here.
  const islands = useMemo(() => {
    const animals = selectVisibleAnimals({ animals: allAnimals, revealPending });
    const own = buildIslandModel({ world, islandLevel, animals });
    const list: { model: IslandModel; mode: IslandMode }[] = [{ model: own, mode: 'own' }];
    if (DEV_TWO_ISLANDS !== null) list.push({ model: devSecondIsland(own, DEV_TWO_ISLANDS), mode: 'visit' });
    return list;
  }, [world, islandLevel, allAnimals, revealPending]);

  const focusing = phase.kind === 'focus';
  const tab = focusing || !TABS.some((t) => t.id === activeTab) ? 'island' : activeTab;
  // The tab bar is hidden on Focus (focus rule) and on the Island tab's Settings and Collection pages.
  const showTabs = ready && TABS.length > 1 && !focusing && !(tab === 'island' && phase.kind === 'idle' && view !== 'home');
  useEffect(() => {
    document.documentElement.toggleAttribute('data-tabs', showTabs);
  }, [showTabs]);

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
  } else {
    mode = 'home';
    screen = <HomeScreen />;
  }

  return (
    <>
      <Scene mode={mode} islands={islands} reducedMotion={reducedMotion} theme={theme} />
      {screen}
      {showTabs && phase.kind === 'break' && tab !== 'island' && <BreakPill />}
      {showTabs && <TabBar tabs={TABS} active={tab} onSelect={setTab} label={strings.aria.tabs} />}
    </>
  );
}

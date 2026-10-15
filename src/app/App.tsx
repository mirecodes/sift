import { useMemo } from 'react';
import { selectIslandLevel, selectVisibleAnimals, useApp } from '../store';
import { usePrefersReducedMotion } from '../ui/hooks';
import { BreakScreen } from '../screens/break/BreakScreen';
import { CollectionScreen } from '../screens/collection/CollectionScreen';
import { FocusScreen } from '../screens/focus/FocusScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { Scene } from '../world/Scene';
import type { WorldMode } from '../world/types';
import styles from './App.module.css';

export function App() {
  const ready = useApp((s) => s.ready);
  const phase = useApp((s) => s.phase);
  const view = useApp((s) => s.view);
  const seed = useApp((s) => s.world.seed);
  const allAnimals = useApp((s) => s.animals);
  const revealPending = useApp((s) => s.revealPending);
  const islandLevel = useApp((s) => selectIslandLevel(s));
  const theme = useApp((s) => s.settings.theme);
  const reducedMotion = usePrefersReducedMotion();

  // Overtime and break-over share the render mode of their base phase, so no clock is needed here.
  const animals = useMemo(() => selectVisibleAnimals({ animals: allAnimals, revealPending }), [allAnimals, revealPending]);

  if (!ready) return <div className={styles.blank} />;

  let mode: WorldMode;
  let screen: JSX.Element;
  if (phase.kind === 'focus') {
    mode = 'focus';
    screen = <FocusScreen />;
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
      <Scene mode={mode} seed={seed} islandLevel={islandLevel} animals={animals} reducedMotion={reducedMotion} theme={theme} />
      {screen}
    </>
  );
}

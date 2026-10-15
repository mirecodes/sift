import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import type { Group } from 'three';
import { config } from '../domain/config';
import { generateIsland } from '../domain/island/island';
import type { IslandMode, IslandModel } from '../domain/island/model';
import { Animals } from './animals/Animals';
import { Island } from './island/Island';
import { Camp } from './props/Camp';
import { CoinPile } from './props/CoinPile';
import { Stream } from './stream/Stream';
import type { WorldMode } from './types';

interface BobProps {
  children: ReactNode;
  timeScale: number;
  reducedMotion: boolean;
  /** Island offset on the ground plane; the bob animates only y. */
  position?: [number, number, number];
  name: string;
}

/** Slow up-and-down bob of the whole island (DESIGN.md 18). */
function Bob({ children, timeScale, reducedMotion, position, name }: BobProps) {
  const group = useRef<Group>(null);
  const t = useRef(0);
  useFrame((_, delta) => {
    if (!group.current) return;
    t.current += Math.min(delta, 0.1) * timeScale;
    group.current.position.y = reducedMotion ? 0 : Math.sin((t.current / config.render.bobPeriodS) * Math.PI * 2) * config.render.bobAmplitude;
  });
  return (
    <group ref={group} position={position} name={name}>
      {children}
    </group>
  );
}

interface Props {
  model: IslandModel;
  mode: IslandMode;
  /** Render mode of the shared canvas (Home, Focus, Break, paused). */
  worldMode: WorldMode;
  /** Shared 0..1 day/night factor, owned by the scene's lights. */
  night: MutableRefObject<number>;
  dark: boolean;
  reducedMotion: boolean;
  position?: [number, number, number];
}

/** Draws one island from plain data (ADR-034). Holds no global state, so several can render at once. */
export function IslandScene({ model, mode, worldMode, night, dark, reducedMotion, position }: Props) {
  const { seed, islandLevel } = model;
  const { tiles, streams } = useMemo(() => generateIsland(seed, islandLevel), [seed, islandLevel]);
  const timeScale = worldMode === 'focus' ? config.render.focusAnimalTimeScale : 1;
  return (
    <Bob timeScale={timeScale} reducedMotion={reducedMotion} position={position} name={`island:${model.ownerId}:${mode}`}>
      <Island seed={seed} level={islandLevel} animate={!reducedMotion} />
      <Stream streams={streams} tiles={tiles} timeScale={timeScale} reducedMotion={reducedMotion} />
      <Camp night={night} reducedMotion={reducedMotion} />
      <CoinPile level={model.goldPileLevel} night={night} sparkle={!reducedMotion && worldMode !== 'focus'} />
      <Animals animals={model.animals} tiles={tiles} mode={worldMode} dark={dark} timeScale={timeScale} reducedMotion={reducedMotion} />
    </Bob>
  );
}

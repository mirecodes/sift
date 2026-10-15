import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import type { Group } from 'three';
import { config } from '../domain/config';
import { generateIsland } from '../domain/island/island';
import type { IslandMode, IslandModel } from '../domain/island/model';
import { Animals } from './animals/Animals';
import { Island } from './island/Island';
import { Camp } from './props/Camp';
import { Buildings } from './props/Buildings';
import { CoinPile } from './props/CoinPile';
import { FIELD_PRESETS, ParticleField } from './presets/particles';
import { themeDef, themePalette } from './voxel/geometry';
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
  /** Drawn in island space (build-mode ghost, Studio overlays). */
  children?: ReactNode;
}

/** Draws one island from plain data (ADR-034). Holds no global state, so several can render at once. */
export function IslandScene({ model, mode, worldMode, night, dark, reducedMotion, position, children }: Props) {
  const { seed, islandLevel } = model;
  const { tiles, streams, side } = useMemo(() => generateIsland(seed, islandLevel), [seed, islandLevel]);
  const heights = useMemo(() => new Map(tiles.map((t) => [`${t.x},${t.z}`, t.top])), [tiles]);
  const timeScale = worldMode === 'focus' ? config.render.focusAnimalTimeScale : 1;
  const blocks = themePalette(model.blockThemeId);
  const ambient = themeDef(model.blockThemeId)?.ambient as keyof typeof FIELD_PRESETS | undefined;
  return (
    <Bob timeScale={timeScale} reducedMotion={reducedMotion} position={position} name={`island:${model.ownerId}:${mode}`}>
      <Island seed={seed} level={islandLevel} animate={!reducedMotion} blocks={blocks} />
      <Stream streams={streams} tiles={tiles} timeScale={timeScale} reducedMotion={reducedMotion} blocks={blocks} />
      <Camp night={night} reducedMotion={reducedMotion} blocks={blocks} />
      <CoinPile level={model.goldPileLevel} night={night} sparkle={!reducedMotion && worldMode !== 'focus'} />
      <Buildings buildings={model.buildings} heights={heights} night={night} timeScale={timeScale} reducedMotion={reducedMotion} />
      <Animals animals={model.animals} tiles={tiles} mode={worldMode} dark={dark} timeScale={timeScale} reducedMotion={reducedMotion} />
      {/* Theme weather drifts over the island on Home and Break only, like the clouds. */}
      {ambient && FIELD_PRESETS[ambient] && worldMode !== 'focus' && (
        <group position={[0, 0.5, 0]}>
          <ParticleField spec={FIELD_PRESETS[ambient]} area={[side, 3, side]} timeScale={timeScale} night={night} reducedMotion={reducedMotion} />
        </group>
      )}
      {children}
    </Bob>
  );
}

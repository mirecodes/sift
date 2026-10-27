import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import type { Group } from 'three';
import { config } from '../domain/config';
import { generateIsland } from '../domain/island/island';
import { getOccupancy } from '../domain/island/occupancy';
import type { IslandMode, IslandModel } from '../domain/island/model';
import { Animals } from './animals/Animals';
import { Island } from './island/Island';
import { Camp } from './props/Camp';
import { Buildings } from './props/Buildings';
import { CoinPile } from './props/CoinPile';
import { VisitMarker } from './props/VisitMarker';
import { FIELD_PRESETS, ParticleField } from './presets/particles';
import { themeDef, themePalette } from './voxel/geometry';
import { Stream } from './stream/Stream';
import type { WorldMode } from './types';

interface BobProps extends IslandMotion {
  children: ReactNode;
  timeScale: number;
  reducedMotion: boolean;
  /** Island offset on the ground plane; the bob animates only y. */
  position?: [number, number, number];
  name: string;
}

/** Extra island motion driven by a sequence (island move, Step 4.3). */
export interface IslandMotion {
  /** Added to the island's height every frame (rise, sink). */
  lift?: MutableRefObject<number>;
  /** Receives the island's bob offset every frame, so things drawn outside it can follow. */
  bobY?: MutableRefObject<number>;
  /** The bob fades out (over ~0.6 s) while true. */
  calm?: boolean;
}

/** Slow up-and-down bob of the whole island (DESIGN.md 18). */
function Bob({ children, timeScale, reducedMotion, position, name, lift, bobY, calm }: BobProps) {
  const group = useRef<Group>(null);
  const t = useRef(0);
  const amplitude = useRef(calm ? 0 : 1);
  useFrame((_, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 0.1);
    t.current += dt * timeScale;
    amplitude.current += ((calm ? 0 : 1) - amplitude.current) * Math.min(1, dt * 5);
    const bob = reducedMotion ? 0 : Math.sin((t.current / config.render.bobPeriodS) * Math.PI * 2) * config.render.bobAmplitude * amplitude.current;
    if (bobY) bobY.current = bob;
    group.current.position.y = bob + (lift?.current ?? 0);
  });
  return (
    <group ref={group} position={position} name={name}>
      {children}
    </group>
  );
}

interface Props extends IslandMotion {
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
export function IslandScene({ model, mode, worldMode, night, dark, reducedMotion, position, children, lift, bobY, calm }: Props) {
  const { seed, islandLevel } = model;
  const { tiles, streams, side } = useMemo(() => generateIsland(seed, islandLevel), [seed, islandLevel]);
  const heights = useMemo(() => new Map(tiles.map((t) => [`${t.x},${t.z}`, t.top])), [tiles]);
  // Where animals can walk (Step 3.12): buildings, water and camp block; other animals do not.
  const walkGrid = useMemo(() => getOccupancy({ seed, islandLevel, animals: [], buildings: model.buildings }), [seed, islandLevel, model.buildings]);
  const timeScale = worldMode === 'focus' ? config.render.focusAnimalTimeScale : 1;
  const blocks = themePalette(model.blockThemeId);
  const themeItem = themeDef(model.blockThemeId);
  const ambient = themeItem?.ambient as keyof typeof FIELD_PRESETS | undefined;
  return (
    <Bob timeScale={timeScale} reducedMotion={reducedMotion} position={position} name={`island:${model.ownerId}:${mode}`} lift={lift} bobY={bobY} calm={calm}>
      <Island seed={seed} level={islandLevel} animate={!reducedMotion} blocks={blocks} tints={themeItem?.tileTints} shiny={themeItem?.finish === 'glossy'} />
      <Stream streams={streams} tiles={tiles} timeScale={timeScale} reducedMotion={reducedMotion} blocks={blocks} />
      <Camp night={night} reducedMotion={reducedMotion} blocks={blocks} />
      <CoinPile level={model.goldPileLevel} night={night} sparkle={!reducedMotion && worldMode !== 'focus'} />
      {model.visitCount !== undefined && <VisitMarker visits={model.visitCount} />}
      <Buildings buildings={model.buildings} heights={heights} night={night} timeScale={timeScale} reducedMotion={reducedMotion} />
      <Animals animals={model.animals} tiles={tiles} walkGrid={walkGrid} mode={worldMode} dark={dark} timeScale={timeScale} reducedMotion={reducedMotion} />
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

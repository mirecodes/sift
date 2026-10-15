import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import { Color, type AmbientLight, type DirectionalLight } from 'three';
import { config } from '../domain/config';
import { hash01 } from '../domain/random';
import type { IslandMode, IslandModel } from '../domain/island/model';
import { CameraRig, ELEVATION, type CameraControls } from './camera/CameraRig';
import { Clouds } from './Clouds';
import { islandExtent } from './island/Island';
import { IslandScene } from './IslandScene';
import { lighting, night as nightPalette, palette } from './palette';
import { RenderDriver } from './RenderDriver';
import { themeDef } from './voxel/geometry';
import type { WorldMode } from './types';
import styles from './Scene.module.css';

interface SceneProps {
  mode: WorldMode;
  /** One island normally; several (side by side, left to right on screen) for moves, visits and battles. */
  islands: readonly { model: IslandModel; mode: IslandMode }[];
  reducedMotion: boolean;
  theme: 'light' | 'dark';
  /** Extra objects in the first island's space, bobbing with it (build mode ghost, Studio overlays). */
  children?: ReactNode;
}

/** Empty space between neighbouring islands, in blocks along the screen. */
const ISLAND_GAP = 3;
/** Screen-right direction of the isometric camera on the ground plane. */
const RIGHT = [Math.SQRT1_2, 0, -Math.SQRT1_2] as const;

const STARS = Array.from({ length: 40 }, (_, i) => {
  const x = hash01(7, i, 1) * 100;
  const y = hash01(7, i, 2) * 65;
  const r = 0.8 + hash01(7, i, 3) * 1.1;
  return `radial-gradient(${r}px ${r}px at ${x}% ${y}%, rgba(255,255,255,${0.5 + hash01(7, i, 4) * 0.5}), transparent)`;
}).join(',');

const c1 = new Color();
const c2 = new Color();

/** Blends day and night lighting; owns the shared 0..1 `night` factor. */
function Lights({ night, target, reducedMotion }: { night: MutableRefObject<number>; target: number; reducedMotion: boolean }) {
  const ambient = useRef<AmbientLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const invalidate = useThree((s) => s.invalidate);
  const [dx, dy, dz] = lighting.direction;
  const k = lighting.intensityScale;
  useEffect(() => invalidate(), [target, invalidate]);
  useFrame((_, delta) => {
    const rate = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 3);
    night.current += (target - night.current) * rate;
    const n = night.current;
    if (ambient.current) {
      ambient.current.color.copy(c1.set('#FFFFFF').lerp(c2.set(nightPalette.ambientColor), n));
      ambient.current.intensity = (lighting.ambient + (nightPalette.ambient - lighting.ambient) * n) * k;
    }
    if (sun.current) {
      sun.current.color.copy(c1.set('#FFFFFF').lerp(c2.set(nightPalette.directionalColor), n));
      sun.current.intensity = (lighting.directional + (nightPalette.directional - lighting.directional) * n) * k;
    }
    if (target !== n && Math.abs(target - n) > 0.002) invalidate();
  });
  return (
    <>
      <ambientLight ref={ambient} intensity={lighting.ambient * k} />
      <directionalLight ref={sun} position={[dx * 50, dy * 50, dz * 50]} intensity={lighting.directional * k} />
    </>
  );
}

/**
 * Islands side by side along the screen's horizontal axis, and the extent the camera must fit.
 * One island sits at the origin and fits exactly as before.
 */
function useLayout(islands: SceneProps['islands']) {
  const key = islands.map(({ model }) => `${model.seed}:${model.islandLevel}`).join('|');
  return useMemo(() => {
    const extents = islands.map(({ model }) => islandExtent(model.seed, model.islandLevel));
    const maxSide = Math.max(...extents.map((e) => e.side));
    const spacing = maxSide * Math.SQRT2 + ISLAND_GAP;
    const n = islands.length;
    const positions = islands.map((_, i): [number, number, number] => {
      const d = (i - (n - 1) / 2) * spacing;
      return [RIGHT[0] * d, 0, RIGHT[2] * d];
    });
    return {
      positions,
      side: maxSide + (spacing * (n - 1)) / Math.SQRT2,
      depth: Math.max(...extents.map((e) => e.depth)),
      rise: Math.max(...extents.map((e) => e.rise)),
    };
  }, [key]); // `key` captures everything the layout depends on
}

/** The one persistent canvas shared by Home, Focus, and Break. It is never remounted. */
export function Scene({ mode, islands, reducedMotion, theme, children }: SceneProps) {
  const dark = theme === 'dark';
  const night = useRef(dark ? 1 : 0);
  const controls = useRef<CameraControls>({ azimuth: 0, zoom: 1 });
  const { positions, side, depth, rise } = useLayout(islands);
  const primary = islands[0]?.model;

  return (
    <div className={styles.root} aria-hidden="true">
      <div
        className={`${styles.sky} ${mode === 'focus' ? styles.skyHidden : ''}`}
        style={{ background: `linear-gradient(to bottom, ${palette.skyTop}, ${palette.skyBottom})` }}
      />
      <div
        className={`${styles.sky} ${mode === 'focus' || !dark ? styles.skyHidden : ''}`}
        style={{ background: `${STARS}, linear-gradient(to bottom, ${nightPalette.skyTop}, ${nightPalette.skyBottom})` }}
      />
      <Canvas
        orthographic
        flat
        dpr={[1, config.render.maxPixelRatio]}
        gl={{ antialias: true, alpha: true }}
        camera={{ near: 0.1, far: 400, zoom: 40, position: [40, 40 * Math.tan(ELEVATION), 40] }}
        frameloop="always"
      >
        <Lights night={night} target={dark ? 1 : 0} reducedMotion={reducedMotion} />
        <RenderDriver mode={mode} />
        <CameraRig mode={mode} side={side} depth={depth} rise={rise} reducedMotion={reducedMotion} controls={controls} />
        {islands.map(({ model, mode: islandMode }, i) => (
          <IslandScene
            key={`${model.ownerId}:${i}`}
            model={model}
            mode={islandMode}
            worldMode={mode}
            night={night}
            dark={dark}
            reducedMotion={reducedMotion}
            position={positions[i]}
          >
            {i === 0 && children}
          </IslandScene>
        ))}
        {primary && (
          <Clouds seed={primary.seed} side={side} depth={depth} visible={mode === 'home' || mode === 'break'} reducedMotion={reducedMotion} night={night} tint={themeDef(primary.blockThemeId)?.cloudTint} />
        )}
      </Canvas>
    </div>
  );
}

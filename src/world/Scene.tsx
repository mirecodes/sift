import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import { Color, type AmbientLight, type DirectionalLight, type Group } from 'three';
import { config } from '../domain/config';
import { hash01 } from '../domain/random';
import { generateIsland } from '../domain/island/island';
import type { PlacedAnimal } from '../domain/types';
import { Animals } from './animals/Animals';
import { CameraRig, ELEVATION, type CameraControls } from './camera/CameraRig';
import { Clouds } from './Clouds';
import { Island, islandExtent } from './island/Island';
import { Camp } from './props/Camp';
import { Stream } from './stream/Stream';
import { lighting, night as nightPalette, palette } from './palette';
import { RenderDriver } from './RenderDriver';
import type { WorldMode } from './types';
import styles from './Scene.module.css';

interface SceneProps {
  mode: WorldMode;
  seed: number;
  /** Island level (lifetime earned animals); sizes the island. */
  islandLevel: number;
  animals: readonly PlacedAnimal[];
  reducedMotion: boolean;
  theme: 'light' | 'dark';
}

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

/** Slow up-and-down bob of the whole island (DESIGN.md 18). */
function Bob({ children, timeScale, reducedMotion }: { children: ReactNode; timeScale: number; reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  const t = useRef(0);
  useFrame((_, delta) => {
    if (!group.current) return;
    t.current += Math.min(delta, 0.1) * timeScale;
    group.current.position.y = reducedMotion ? 0 : Math.sin((t.current / config.render.bobPeriodS) * Math.PI * 2) * config.render.bobAmplitude;
  });
  return <group ref={group}>{children}</group>;
}

/** The one persistent canvas shared by Home, Focus, and Break. It is never remounted. */
export function Scene({ mode, seed, islandLevel, animals, reducedMotion, theme }: SceneProps) {
  const dark = theme === 'dark';
  const night = useRef(dark ? 1 : 0);
  const { tiles, streams } = useMemo(() => generateIsland(seed, islandLevel), [seed, islandLevel]);
  const controls = useRef<CameraControls>({ azimuth: 0, zoom: 1 });
  const { side, depth, rise } = useMemo(() => islandExtent(seed, islandLevel), [seed, islandLevel]);
  const timeScale = mode === 'focus' ? config.render.focusAnimalTimeScale : 1;

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
        <Bob timeScale={timeScale} reducedMotion={reducedMotion}>
          <Island seed={seed} level={islandLevel} animate={!reducedMotion} />
          <Stream streams={streams} tiles={tiles}timeScale={timeScale} reducedMotion={reducedMotion} />
          <Camp night={night} reducedMotion={reducedMotion} />
          <Animals animals={animals} tiles={tiles} mode={mode} dark={dark} timeScale={timeScale} reducedMotion={reducedMotion} />
        </Bob>
        <Clouds seed={seed} side={side} depth={depth} visible={mode === 'home' || mode === 'break'} reducedMotion={reducedMotion} night={night} />
      </Canvas>
    </div>
  );
}

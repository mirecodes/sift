import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PointLight,
} from 'three';
import { CAMP_LEVEL, FIRE_TILE, HUT_TILE, levelTop } from '../../domain/island/island';
import { defaultBlocks, night as nightPalette } from '../palette';
import { glowTexture } from '../presets/lights';

const SURFACE_Y = levelTop(CAMP_LEVEL) + 0.5;
/** Where animals enter the hut: in front of the door (+x face, toward the fire) and at the door. */
export const HUT_APPROACH = { x: HUT_TILE.x + 1.15, z: HUT_TILE.z } as const;
export const HUT_DOOR = { x: HUT_TILE.x + 0.67, z: HUT_TILE.z } as const;

const box = new BoxGeometry(1, 1, 1);
const lambert = (color: string) => new MeshLambertMaterial({ color, flatShading: true });
const logLight = lambert(defaultBlocks.cabinLog);
const logDark = lambert(defaultBlocks.cabinLogDark);
const beam = lambert(defaultBlocks.cabinBeam);
const roofLight = lambert(defaultBlocks.cabinRoof);
const roofDark = lambert(defaultBlocks.cabinRoofDark);
const stone = lambert(defaultBlocks.campStone);
const stoneDark = lambert(defaultBlocks.campStoneDark);
const smokeMaterial = new MeshBasicMaterial({ color: '#D9DCE6', transparent: true, opacity: 0 });
const log = new MeshLambertMaterial({ color: defaultBlocks.firewood, flatShading: true });
const doorDay = new Color('#3B2A1E');
const doorNight = new Color('#FFB050');
const flameColors = ['#FF7A1A', '#FFB33D', '#FFE38A'].map((c) => new MeshBasicMaterial({ color: c }));

/** Hut and campfire on their reserved tiles. `night` is the shared 0..1 day/night factor. */
export function Camp({ night, reducedMotion }: { night: MutableRefObject<number>; reducedMotion: boolean }) {
  const light = useRef<PointLight>(null);
  const flames = useRef<Group>(null);
  const glow = useRef<Mesh>(null);
  const door = useRef<Mesh>(null);
  const smoke = useRef<Group>(null);
  const glowMaterial = useMemo(
    () => new MeshBasicMaterial({ map: glowTexture(), color: nightPalette.fire, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 }),
    [],
  );
  const doorMaterial = useMemo(() => new MeshBasicMaterial({ color: doorDay }), []);

  useFrame(({ clock }) => {
    const n = night.current;
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const flicker = 1 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23 + 1) * 0.05;
    if (light.current) light.current.intensity = n * 6 * flicker;
    glowMaterial.opacity = n * 0.55 * flicker;
    if (glow.current) glow.current.visible = n > 0.01;
    doorMaterial.color.copy(doorDay).lerp(doorNight, n);
    // Chimney smoke: three puffs rise and fade in a loop, only at night (the hearth is lit).
    smoke.current?.children.forEach((puff, i) => {
      const p = (t * 0.35 + i / 3) % 1;
      puff.position.set(Math.sin(t + i * 2) * 0.05 * p, p * 0.6, 0);
      puff.scale.setScalar(0.1 + p * 0.14);
    });
    smokeMaterial.opacity = n * 0.5;
    const f = flames.current;
    if (f) {
      f.visible = n > 0.05;
      f.children.forEach((child, i) => {
        const s = n * (1 + Math.sin(t * (8 + i * 3) + i) * 0.18);
        child.scale.set(0.2 - i * 0.05, (0.2 - i * 0.03) * s, 0.2 - i * 0.05);
        child.position.y = 0.1 + i * 0.09 + ((0.2 - i * 0.03) * s) / 2;
        child.rotation.y = t * (1 + i) * 0.7;
      });
    }
  });

  return (
    <>
      {/* Campfire */}
      <group position={[FIRE_TILE.x, SURFACE_Y, FIRE_TILE.z]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={box} material={log} position={[0, 0.045, 0]} rotation={[0, (i * Math.PI) / 3, 0]} scale={[0.42, 0.09, 0.09]} />
        ))}
        <group ref={flames}>
          {flameColors.map((m, i) => (
            <mesh key={i} geometry={box} material={m} />
          ))}
        </group>
        <pointLight ref={light} position={[0, 0.7, 0]} color={nightPalette.fire} intensity={0} distance={9} decay={1.6} />
        <mesh ref={glow} material={glowMaterial} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} visible={false}>
          <planeGeometry args={[4.4, 4.4]} />
        </mesh>
      </group>
      {/* Hut */}
      {/* Log cabin: ~1.5 blocks wide, ridge along x so the gable end (with the door) faces the fire. */}
      <group position={[HUT_TILE.x, SURFACE_Y, HUT_TILE.z]}>
        <mesh geometry={box} material={stone} position={[0, 0.04, 0]} scale={[1.4, 0.08, 1.2]} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <group key={i}>
            <mesh geometry={box} material={i % 2 ? logLight : logDark} position={[0, 0.13 + i * 0.1, 0]} scale={[1.3, 0.1, 1.0]} />
            <mesh geometry={box} material={i % 2 ? logDark : logLight} position={[0, 0.13 + i * 0.1, 0]} scale={[1.0, 0.1, 1.1]} />
          </group>
        ))}
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={box} material={beam} position={[sx * 0.62, 0.38, sz * 0.52]} scale={[0.1, 0.6, 0.1]} />
        )))}
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} geometry={box} material={i % 2 ? roofLight : roofDark} position={[0, 0.74 + i * 0.12, 0]} scale={[1.56, 0.12, 1.4 - i * 0.3]} />
        ))}
        <mesh geometry={box} material={roofDark} position={[0, 1.36, 0]} scale={[1.6, 0.05, 0.16]} />
        <mesh geometry={box} material={stone} position={[-0.3, 0.63, -0.25]} scale={[0.26, 1.1, 0.26]} />
        <mesh geometry={box} material={stoneDark} position={[-0.3, 1.2, -0.25]} scale={[0.34, 0.07, 0.34]} />
        <group ref={smoke} position={[-0.3, 1.25, -0.25]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} geometry={box} material={smokeMaterial} />
          ))}
        </group>
        <mesh geometry={box} material={beam} position={[0.655, 0.27, 0]} scale={[0.03, 0.5, 0.36]} />
        <mesh ref={door} geometry={box} material={doorMaterial} position={[0.67, 0.25, 0]} scale={[0.03, 0.44, 0.28]} />
        <mesh geometry={box} material={stone} position={[0.78, 0.03, 0]} scale={[0.22, 0.06, 0.4]} />
        <mesh geometry={box} material={beam} position={[0.1, 0.45, 0.505]} scale={[0.34, 0.3, 0.03]} />
        <mesh geometry={box} material={doorMaterial} position={[0.1, 0.45, 0.52]} scale={[0.26, 0.22, 0.03]} />
      </group>
    </>
  );
}

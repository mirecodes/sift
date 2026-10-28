import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { BoxGeometry, MeshLambertMaterial, type Group } from 'three';
import { CAMP_LEVEL, HUT_TILE, levelTop } from '../../domain/island/island';

const SURFACE_Y = levelTop(CAMP_LEVEL) + 0.5;
const box = new BoxGeometry(1, 1, 1);
const pole = new MeshLambertMaterial({ color: '#7A5532', flatShading: true });
const banner = new MeshLambertMaterial({ color: '#FFAE13', flatShading: true });
const POLE = 1.2;
const RISE_S = 1.2;

/**
 * The weekly champion's flag (guidance_v2 Step 8.6, DESIGN.md 15.8): a pole at the hut tile's corner with
 * a yellow banner that rises once and then sways gently (still on Focus and with reduced motion).
 */
export function ChampionFlag({ still }: { still: boolean }) {
  const flag = useRef<Group>(null);
  const born = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const g = flag.current;
    if (!g) return;
    born.current ??= clock.elapsedTime;
    const up = still ? 1 : Math.min(1, (clock.elapsedTime - born.current) / RISE_S);
    g.position.y = 0.35 + (POLE - 0.5) * up;
    g.rotation.y = still ? 0 : Math.sin(clock.elapsedTime * Math.PI) * 0.18;
  });
  return (
    <group position={[HUT_TILE.x + 0.42, SURFACE_Y, HUT_TILE.z - 0.42]} name="champion-flag">
      <mesh geometry={box} material={pole} scale={[0.05, POLE, 0.05]} position={[0, POLE / 2, 0]} />
      <group ref={flag} position={[0, POLE - 0.15, 0]}>
        <mesh geometry={box} material={banner} scale={[0.45, 0.3, 0.03]} position={[0.25, 0, 0]} />
      </group>
    </group>
  );
}

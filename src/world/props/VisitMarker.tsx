import { BoxGeometry, MeshLambertMaterial } from 'three';
import { CAMP_LEVEL, COIN_PILE_TILE, levelTop } from '../../domain/island/island';
import { palette } from '../palette';

const SURFACE_Y = levelTop(CAMP_LEVEL) + 0.5;
const box = new BoxGeometry(1, 1, 1);
const post = new MeshLambertMaterial({ color: palette.coinDark, flatShading: true });
const sign = new MeshLambertMaterial({ color: '#FFFFFF', flatShading: true });

/**
 * Placeholder for visit traces (guidance_v2 Step 7.5, `features.visitTraceProp`, off by default): a small
 * post at the corner of the coin-pile tile whose sign grows a little with the visit count, so the
 * rendering hook exists until the real design is decided.
 */
export function VisitMarker({ visits }: { visits: number }) {
  if (visits <= 0) return null;
  const size = 0.16 + Math.min(0.14, Math.log2(1 + visits) * 0.03);
  return (
    <group position={[COIN_PILE_TILE.x - 0.35, SURFACE_Y, COIN_PILE_TILE.z + 0.35]} name="visit-marker">
      <mesh geometry={box} material={post} scale={[0.05, 0.36, 0.05]} position={[0, 0.18, 0]} />
      <mesh geometry={box} material={sign} scale={[size, size * 0.7, 0.04]} position={[0, 0.36, 0]} />
    </group>
  );
}

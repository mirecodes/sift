import { useMemo } from 'react';
import { MeshBasicMaterial, PlaneGeometry } from 'three';
import type { Tile } from '../../domain/island/island';
import { tileKey } from '../../domain/island/occupancy';
import { palette } from '../palette';

const plane = new PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
const ok = new MeshBasicMaterial({ color: palette.buildOk, transparent: true, opacity: 0.45, depthWrite: false });
const bad = new MeshBasicMaterial({ color: palette.buildBad, transparent: true, opacity: 0.45, depthWrite: false });

/** Tinted squares on the tiles a building would cover: green when it fits, red when not (DESIGN.md 15.7). */
export function Footprint({ tiles, valid, heights }: { tiles: readonly Tile[]; valid: boolean; heights: ReadonlyMap<string, number> }) {
  const top = useMemo(() => Math.max(...tiles.map((t) => heights.get(tileKey(t)) ?? 0)), [tiles, heights]);
  return (
    <group>
      {tiles.map((t) => (
        <mesh key={tileKey(t)} geometry={plane} material={valid ? ok : bad} position={[t.x, (heights.get(tileKey(t)) ?? top) + 0.52, t.z]} renderOrder={2} />
      ))}
    </group>
  );
}

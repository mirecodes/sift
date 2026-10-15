import { useFrame } from '@react-three/fiber';
import { memo, useMemo, useRef, type MutableRefObject } from 'react';
import { Group, MeshLambertMaterial } from 'three';
import type { Tile } from '../../domain/island/island';
import type { IslandBuilding } from '../../domain/island/model';
import { buildingShape, footprintTiles, tileKey } from '../../domain/island/occupancy';
import { LightGlow, type LightPresetId } from '../presets/lights';
import { PART_PRESETS } from '../presets/parts';
import { buildingMeshes } from '../voxel/geometry';

const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

const hash = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
};

interface Props {
  buildings: readonly IslandBuilding[];
  /** Surface height (`Cell.top`) per `"x,z"`. */
  heights: ReadonlyMap<string, number>;
  night: MutableRefObject<number>;
  timeScale: number;
  reducedMotion: boolean;
}

/** World position of a building: the middle of its footprint, on the surface of its tiles. */
export function buildingPosition(defId: string, tile: Tile, rotation: IslandBuilding['rotation'], heights: ReadonlyMap<string, number>): [number, number, number] {
  const tiles = footprintTiles(tile, buildingShape(defId).footprint, rotation);
  const x = tiles.reduce((s, t) => s + t.x, 0) / tiles.length;
  const z = tiles.reduce((s, t) => s + t.z, 0) / tiles.length;
  const top = Math.max(...tiles.map((t) => heights.get(tileKey(t)) ?? 0));
  return [x, top + 0.5, z];
}

const Building = memo(function Building({ b, heights, night, timeScale, reducedMotion }: { b: IslandBuilding } & Omit<Props, 'buildings'>) {
  const meshes = buildingMeshes(b.defId);
  const parts = useRef<(Group | null)[]>([]);
  const t = useRef(0);
  const phase = useMemo(() => hash(b.id), [b.id]);
  const position = useMemo(() => buildingPosition(b.defId, b.tile, b.rotation, heights), [b.defId, b.tile, b.rotation, heights]);

  useFrame((_, delta) => {
    if (!meshes || reducedMotion) return;
    t.current += Math.min(delta, 0.1) * timeScale;
    meshes.parts.forEach((p, i) => {
      const g = parts.current[i];
      if (g) PART_PRESETS[p.preset]?.(g, t.current, phase);
    });
  });

  if (!meshes) return null;
  return (
    <group position={position} rotation={[0, (-b.rotation * Math.PI) / 180, 0]} name={`building:${b.id}`}>
      <mesh geometry={meshes.main} material={material} />
      {meshes.parts.map((p, i) => (
        <group key={p.name} position={p.pivot} userData={{ baseY: p.pivot[1] }} ref={(g) => void (parts.current[i] = g)}>
          <mesh geometry={p.geometry} material={material} />
        </group>
      ))}
      {meshes.def.light && <LightGlow id={meshes.def.light as LightPresetId} night={night} position={meshes.lightAt} />}
    </group>
  );
});

/** Placed buildings and decorations (Step 3.11) with their part animations and lights (Step 3.2 presets). */
export function Buildings({ buildings, ...rest }: Props) {
  return (
    <>
      {buildings.map((b) => (
        <Building key={b.id} b={b} {...rest} />
      ))}
    </>
  );
}

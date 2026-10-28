import type { ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { InstancedMesh, MeshBasicMaterial, MeshLambertMaterial, Object3D, PlaneGeometry } from 'three';
import { getSpecies } from '../../domain/animals/catalog';
import { config } from '../../domain/config';
import type { Cell, Tile } from '../../domain/island/island';
import { Footprint } from '../props/Footprint';
import { animalGeometry } from '../voxel/geometry';

const hitPlane = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const hitMaterial = new MeshBasicMaterial({ visible: false });
const ghostMaterial = new MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.6, depthWrite: false });
const dummy = new Object3D();

export interface ArrangeHandlers {
  onDown(tile: Tile, pointerType: string): void;
  onMove(tile: Tile): void;
  onUp(tile: Tile | null): void;
  onTap(tile: Tile): void;
}

/**
 * Arrange mode in the island's space (Step 10.1): invisible tile targets that report press, move,
 * release and tap; the target tile's tint and a see-through copy of the picked animal standing on it.
 */
export function ArrangeLayer({ tiles, picked, target, valid, handlers }: { tiles: readonly Cell[]; picked: { speciesId: string; skinId?: string } | null; target: Tile | null; valid: boolean; handlers: ArrangeHandlers }) {
  const mesh = useRef<InstancedMesh>(null);
  const heights = useMemo(() => new Map(tiles.map((t) => [`${t.x},${t.z}`, t.top])), [tiles]);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    tiles.forEach((t, i) => {
      dummy.position.set(t.x, t.top + 0.51, t.z);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [tiles]);
  const at = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId === undefined ? undefined : tiles[e.instanceId]);
  const geometry = useMemo(() => (picked ? animalGeometry(getSpecies(picked.speciesId).modelId, picked.skinId) : null), [picked]);

  return (
    <group>
      <instancedMesh
        key={tiles.length}
        ref={mesh}
        args={[hitPlane, hitMaterial, tiles.length]}
        onPointerDown={(e) => {
          const t = at(e);
          if (t) handlers.onDown(t, e.pointerType);
        }}
        onPointerMove={(e) => {
          const t = at(e);
          if (t) handlers.onMove(t);
        }}
        onPointerUp={(e) => handlers.onUp(at(e) ?? null)}
        onClick={(e) => {
          const t = at(e);
          if (t) handlers.onTap(t);
        }}
      />
      {target && picked && geometry && (
        <>
          <Footprint tiles={[target]} valid={valid} heights={heights} />
          <mesh geometry={geometry} material={ghostMaterial} scale={config.render.animalScale} position={[target.x, (heights.get(`${target.x},${target.z}`) ?? 0) + 0.5, target.z]} />
        </>
      )}
    </group>
  );
}

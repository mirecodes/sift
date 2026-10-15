import type { ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { InstancedMesh, MeshBasicMaterial, MeshLambertMaterial, Object3D, PlaneGeometry } from 'three';
import type { Cell, Tile } from '../../domain/island/island';
import { buildingShape, footprintTiles, type Rotation } from '../../domain/island/occupancy';
import { buildingPosition } from '../props/Buildings';
import { Footprint } from '../props/Footprint';
import { buildingMeshes } from '../voxel/geometry';

const hitPlane = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const hitMaterial = new MeshBasicMaterial({ visible: false });
const ghostMaterial = new MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.6, depthWrite: false });
const selectMaterial = new MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.5, depthWrite: false });
const dummy = new Object3D();
/** A tap moves more than this many pixels between press and release: it was a drag (camera), not a tap. */
const TAP_SLOP = 6;

interface Props {
  tiles: readonly Cell[];
  placing: { defId: string; rotation: Rotation } | null;
  tile: Tile | null;
  valid: boolean;
  /** Tiles of the selected placed building, outlined. */
  selectedTiles: readonly Tile[];
  onHover(tile: Tile): void;
  onTap(tile: Tile): void;
}

/**
 * Build mode in the island's space (Step 3.11): invisible tile targets for pointer and touch, the
 * see-through ghost of the building being placed on its footprint tint, and the outline of a selected
 * building. Drags still rotate the camera; only short taps count.
 */
export function BuildLayer({ tiles, placing, tile, valid, selectedTiles, onHover, onTap }: Props) {
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
  const ghost = placing && tile ? buildingMeshes(placing.defId) : null;
  const ghostTiles = placing && tile ? footprintTiles(tile, buildingShape(placing.defId).footprint, placing.rotation) : [];

  return (
    <group>
      <instancedMesh
        key={tiles.length}
        ref={mesh}
        args={[hitPlane, hitMaterial, tiles.length]}
        onPointerMove={(e) => {
          const t = at(e);
          if (t && e.pointerType === 'mouse') onHover(t);
        }}
        onClick={(e) => {
          const t = at(e);
          if (!t || e.delta > TAP_SLOP) return;
          e.stopPropagation();
          onTap(t);
        }}
      />
      {ghost && tile && placing && (
        <>
          <Footprint tiles={ghostTiles} valid={valid} heights={heights} />
          <group position={buildingPosition(placing.defId, tile, placing.rotation, heights)} rotation={[0, (-placing.rotation * Math.PI) / 180, 0]}>
            <mesh geometry={ghost.main} material={ghostMaterial} />
            {ghost.glow && <mesh geometry={ghost.glow} material={ghostMaterial} />}
            {ghost.parts.map((p) => (
              <group key={p.name} position={p.pivot}>
                <mesh geometry={p.geometry} material={ghostMaterial} />
              </group>
            ))}
          </group>
        </>
      )}
      {selectedTiles.map((t) => (
        <mesh key={`${t.x},${t.z}`} geometry={hitPlane} material={selectMaterial} position={[t.x, (heights.get(`${t.x},${t.z}`) ?? 0) + 0.53, t.z]} scale={0.94} renderOrder={2} />
      ))}
    </group>
  );
}

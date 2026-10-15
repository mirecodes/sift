import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, MeshLambertMaterial, Object3D } from 'three';
import { config } from '../../domain/config';
import { hash01 } from '../../domain/random';
import { generateIsland, type Block, type BlockKind } from '../../domain/island/island';
import type { BlockPalette } from '../../../shared/content/palette';
import { blockGeometries } from '../voxel/geometry';

const KINDS: BlockKind[] = ['grass', 'dirt', 'stone'];
const dummy = new Object3D();
const tint = new Color();
const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

const keyOf = (b: Block) => `${b.x},${b.y},${b.z}`;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

interface KindMesh {
  blocks: Block[];
  /** Delay in ms for blocks that scale in; -1 for blocks that were already there. */
  delays: Float32Array;
}

interface Props {
  seed: number;
  level: number;
  animate: boolean;
  /** Block theme colors (Step 3.8); the layout is unchanged when they change. */
  blocks?: BlockPalette;
}

/** The floating island: one InstancedMesh per block type. Grows with a scale-in of the new blocks. */
export function Island({ seed, level, animate, blocks }: Props) {
  const layout = useMemo(() => generateIsland(seed, level), [seed, level]);
  const meshes = useRef<Record<BlockKind, InstancedMesh | null>>({ grass: null, dirt: null, stone: null });
  const previous = useRef<Set<string> | null>(null);
  const growth = useRef<{ active: boolean; start: number | null }>({ active: false, start: null });
  const geometries = blockGeometries(blocks);

  const perKind = useMemo(() => {
    const seen = previous.current;
    const out = {} as Record<BlockKind, KindMesh>;
    for (const kind of KINDS) {
      const blocks = layout.blocks.filter((b) => b.kind === kind);
      const delays = new Float32Array(blocks.length).fill(-1);
      if (animate && seen) {
        blocks.forEach((b, i) => {
          if (!seen.has(keyOf(b))) delays[i] = Math.hypot(b.x, b.z) * 35 + Math.abs(b.y) * 25;
        });
      }
      out[kind] = { blocks, delays };
    }
    return out;
  }, [layout, animate]);

  useLayoutEffect(() => {
    let growing = false;
    for (const kind of KINDS) {
      const mesh = meshes.current[kind];
      const { blocks, delays } = perKind[kind];
      if (!mesh) continue;
      blocks.forEach((b, i) => {
        const hidden = (delays[i] as number) >= 0;
        dummy.position.set(b.x, b.y, b.z);
        if (hidden) dummy.scale.setScalar(0);
        else dummy.scale.set(1, b.h, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        // Slight deterministic tint per block for a natural, pixel-like variation.
        tint.setScalar(1 + (hash01(seed, b.x, b.y, b.z + 99) - 0.5) * 0.08);
        mesh.setColorAt(i, tint);
        if (hidden) growing = true;
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    growth.current = { active: growing, start: null };
    previous.current = new Set(layout.blocks.map(keyOf));
  }, [perKind, layout, seed]);

  useFrame(({ clock }) => {
    const g = growth.current;
    if (!g.active) return;
    g.start ??= clock.elapsedTime * 1000;
    const elapsed = clock.elapsedTime * 1000 - g.start;
    let pending = false;
    for (const kind of KINDS) {
      const mesh = meshes.current[kind];
      const { blocks, delays } = perKind[kind];
      if (!mesh) continue;
      blocks.forEach((b, i) => {
        const delay = delays[i] as number;
        if (delay < 0) return;
        const p = Math.min(1, Math.max(0, (elapsed - delay) / config.render.growthMs));
        if (p < 1) pending = true;
        dummy.position.set(b.x, b.y, b.z);
        const e = easeOut(p);
        dummy.scale.set(e, e * b.h, e);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (!pending) g.active = false;
  });

  return (
    <group>
      {KINDS.map((kind) => (
        <instancedMesh
          key={`${kind}-${perKind[kind].blocks.length}`}
          ref={(m) => {
            meshes.current[kind] = m;
          }}
          // Geometry and material are props, not args: a theme swap assigns new block meshes and keeps the instances.
          args={[undefined, undefined, perKind[kind].blocks.length]}
          geometry={geometries[kind]}
          material={material}
          frustumCulled={false}
        />
      ))}
    </group>
  );
}

/** Extent used by the camera to fit the island. */
export function islandExtent(seed: number, level: number): { side: number; depth: number; rise: number } {
  const { side, depth, rise } = generateIsland(seed, level);
  return { side, depth, rise };
}

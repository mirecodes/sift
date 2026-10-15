import { BufferAttribute, BufferGeometry } from 'three';
import { voxelModels } from '../../assets/voxels';
import { butterflyBody, butterflyWing } from '../../assets/voxels/butterfly';
import type { VoxelModel } from '../../assets/voxels/types';
import { defaultBlocks } from '../palette';
import { buildBlockMesh, buildVoxelMesh, type MeshData } from './meshData';

/** Animal voxel = 1/6 block (DESIGN.md 16.2). */
export const VOXEL_SIZE = 1 / 6;

export function toGeometry(data: MeshData): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(data.positions, 3));
  g.setAttribute('normal', new BufferAttribute(data.normals, 3));
  g.setAttribute('color', new BufferAttribute(data.colors, 3));
  g.setIndex(new BufferAttribute(data.indices, 1));
  g.computeBoundingSphere();
  return g;
}

const animalCache = new Map<string, BufferGeometry>();

/** Built once per species and reused by every placed animal. */
export function animalGeometry(modelId: string): BufferGeometry {
  let g = animalCache.get(modelId);
  if (!g) {
    const model = voxelModels[modelId];
    if (!model) throw new Error(`No voxel model for ${modelId}`);
    g = toGeometry(buildVoxelMesh(model, VOXEL_SIZE));
    animalCache.set(modelId, g);
  }
  return g;
}

let flutter: { body: BufferGeometry; wing: BufferGeometry } | undefined;

/** Butterfly body and one wing (mirror it for the other), so the wings can flap (ADR-024). */
export function flutterParts() {
  flutter ??= {
    body: toGeometry(buildVoxelMesh(butterflyBody, VOXEL_SIZE)),
    wing: toGeometry(buildVoxelMesh(butterflyWing, VOXEL_SIZE)),
  };
  return flutter;
}

export function modelById(modelId: string): VoxelModel {
  const model = voxelModels[modelId];
  if (!model) throw new Error(`No voxel model for ${modelId}`);
  return model;
}

let blocks: Record<'grass' | 'dirt' | 'stone', BufferGeometry> | undefined;

export function blockGeometries() {
  blocks ??= {
    grass: toGeometry(buildBlockMesh(defaultBlocks.grassTop, defaultBlocks.grassSide, defaultBlocks.dirtSide)),
    dirt: toGeometry(buildBlockMesh(defaultBlocks.dirtTop, defaultBlocks.dirtSide)),
    stone: toGeometry(buildBlockMesh(defaultBlocks.stoneTop, defaultBlocks.stoneSide)),
  };
  return blocks;
}

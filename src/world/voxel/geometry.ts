import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import { partOrder, partParent, type AnimalPartName } from '../../../shared/content/anatomy';
import { restPose, withOverlay, type ModelColors, type VoxelModel } from '../../../shared/content/model';
import type { BlockPalette } from '../../../shared/content/palette';
import type { AnimalSkinDef, BlockThemeDef, BuildingDef } from '../../../shared/content/schema';
import { content } from '../../domain/content';
import { DEFAULT_SKIN } from '../../domain/island/model';
import { defaultBlocks } from '../palette';
import { buildBlockMesh, buildRiggedVoxelMesh, buildVoxelMesh, type MeshData } from './meshData';

/** Animal voxel = 1/6 block (DESIGN.md 16.2). */
export const VOXEL_SIZE = 1 / 6;
/** Building voxel = 1/8 block: one footprint tile is 8 voxels (DESIGN.md 16.4). */
export const BUILDING_VOXEL = 1 / 8;

export function toGeometry(data: MeshData): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(data.positions, 3));
  g.setAttribute('normal', new BufferAttribute(data.normals, 3));
  g.setAttribute('color', new BufferAttribute(data.colors, 3));
  g.setIndex(new BufferAttribute(data.indices, 1));
  g.computeBoundingSphere();
  return g;
}

/** A known, renderable animal skin, or undefined for the default look (also for unknown ids). */
export function skinDef(skinId: string | undefined): AnimalSkinDef | undefined {
  if (!skinId || skinId === DEFAULT_SKIN) return undefined;
  const item = content.get(skinId);
  return item?.kind === 'animalSkin' ? item : undefined;
}

/** Species model in its rest pose (parts in place, ADR-055) with the skin's overlay voxels, if any. */
export function skinnedModel(modelId: string, skinId?: string): VoxelModel {
  const base = restPose(modelById(modelId));
  const overlay = skinDef(skinId)?.overlay;
  const extra = overlay ? content.model(overlay) : undefined;
  return extra ? withOverlay(base, extra) : base;
}

export const skinColors = (skinId?: string): ModelColors | undefined => skinDef(skinId)?.palette;

const animalCache = new Map<string, BufferGeometry>();

/** Built once per (species, skin) and reused by every placed animal (Step 3.8). */
export function animalGeometry(modelId: string, skinId: string = DEFAULT_SKIN): BufferGeometry {
  const key = `${modelId}|${skinDef(skinId) ? skinId : DEFAULT_SKIN}`;
  let g = animalCache.get(key);
  if (!g) {
    g = toGeometry(buildVoxelMesh(skinnedModel(modelId, skinId), VOXEL_SIZE, skinColors(skinId)));
    animalCache.set(key, g);
  }
  return g;
}

/** One bone of an articulated animal: its part, parent bone index (-1 = the body) and joint, in model units. */
export interface RigBone {
  name: AnimalPartName;
  parent: number;
  pivot: [number, number, number];
}

export interface AnimalRigGeometry {
  /** Bone 0 is the body; vertices carry `skinIndex`/`skinWeight` (one bone each). */
  geometry: BufferGeometry;
  /** Bones after the body, parents first. */
  bones: readonly RigBone[];
}

const rigCache = new Map<string, AnimalRigGeometry>();

/**
 * An articulated animal for `SkinnedMesh` (ADR-055), built once per (species, skin): the body and every
 * anatomy part as their own culled pieces, each following its bone. A skin overlay joins the body.
 */
export function animalRigGeometry(modelId: string, skinId: string = DEFAULT_SKIN): AnimalRigGeometry {
  const key = `${modelId}|${skinDef(skinId) ? skinId : DEFAULT_SKIN}`;
  let rig = rigCache.get(key);
  if (!rig) {
    const base = modelById(modelId);
    const overlay = skinDef(skinId)?.overlay;
    const extra = overlay ? content.model(overlay) : undefined;
    const model = extra ? { ...withOverlay({ ...base, parts: undefined }, extra), parts: base.parts } : base;
    const names = partOrder(Object.keys(model.parts ?? {}));
    const [W, , D] = model.size;
    const v = VOXEL_SIZE;
    const bones = names.map((name): RigBone => {
      const p = model.parts![name]!.pivot;
      const parent = partParent(name);
      return { name, parent: parent ? names.indexOf(parent) : -1, pivot: [(p[0] + 0.5 - W / 2) * v, (p[1] + 0.5) * v, (p[2] + 0.5 - D / 2) * v] };
    });
    const data = buildRiggedVoxelMesh(model, names, v, skinColors(skinId));
    const geometry = toGeometry(data);
    const count = data.bones.length;
    const skinIndex = new Uint16Array(count * 4);
    const skinWeight = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      skinIndex[i * 4] = data.bones[i]!;
      skinWeight[i * 4] = 1;
    }
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndex, 4));
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeight, 4));
    rig = { geometry, bones };
    rigCache.set(key, rig);
  }
  return rig;
}

/** A model from the content registry by its ref (`animals/fox`, `buildings/windmill`). */
export function modelById(modelId: string): VoxelModel {
  const model = content.model(modelId);
  if (!model) throw new Error(`No voxel model for ${modelId}`);
  return model;
}

/** Terrain, water and camp colors of a block theme; unknown ids fall back to the default theme. */
export function themePalette(themeId: string | undefined): BlockPalette {
  const item = themeId ? content.get(themeId) : undefined;
  return item?.kind === 'blockTheme' ? item.palette : defaultBlocks;
}

export function themeDef(themeId: string | undefined): BlockThemeDef | undefined {
  const item = themeId ? content.get(themeId) : undefined;
  return item?.kind === 'blockTheme' ? item : undefined;
}

type BlockGeometries = Record<'grass' | 'dirt' | 'stone', BufferGeometry>;
const blockCache = new WeakMap<BlockPalette, BlockGeometries>();

/** Unit block meshes in one theme's colors. Swapping a theme swaps these; the terrain layout is reused. */
export function blockGeometries(blocks: BlockPalette = defaultBlocks): BlockGeometries {
  let g = blockCache.get(blocks);
  if (!g) {
    g = {
      grass: toGeometry(buildBlockMesh(blocks.grassTop, blocks.grassSide, blocks.dirtSide)),
      dirt: toGeometry(buildBlockMesh(blocks.dirtTop, blocks.dirtSide)),
      stone: toGeometry(buildBlockMesh(blocks.stoneTop, blocks.stoneSide)),
    };
    blockCache.set(blocks, g);
  }
  return g;
}

export interface BuildingMeshes {
  def: BuildingDef;
  model: VoxelModel;
  main: BufferGeometry;
  /** With a light preset: the `flame`/`glass` voxels, drawn unlit so the lamp itself shines. */
  glow: BufferGeometry | null;
  /** Each part's geometry is relative to its pivot; place it in a group at `pivot`. */
  parts: { name: string; preset: string; pivot: [number, number, number]; geometry: BufferGeometry }[];
  /** Where a light preset glows: middle of the `flame`/`glass` voxels, else the top center. */
  lightAt: [number, number, number];
}

const buildingCache = new Map<string, BuildingMeshes | null>();

/** Forget built skin and building meshes after content changed (Content Studio drafts, remote packs). */
export function clearContentGeometry(): void {
  for (const g of animalCache.values()) g.dispose();
  animalCache.clear();
  for (const r of rigCache.values()) r.geometry.dispose();
  rigCache.clear();
  buildingCache.clear();
}

/** Meshes of a building definition (origin at the bottom center of its model), or null if unknown. */
export function buildingMeshes(defId: string): BuildingMeshes | null {
  if (buildingCache.has(defId)) return buildingCache.get(defId)!;
  const def = content.get(defId);
  const model = def?.kind === 'building' ? content.model(def.model) : undefined;
  let out: BuildingMeshes | null = null;
  if (def?.kind === 'building' && model) {
    const [W, H, D] = model.size;
    const v = BUILDING_VOXEL;
    const world = (x: number, y: number, z: number): [number, number, number] => [(x + 0.5 - W / 2) * v, (y + 0.5) * v, (z + 0.5 - D / 2) * v];
    const parts = (def.parts ?? []).flatMap((p) => {
      const part = model.parts?.[p.name];
      if (!part) return [];
      const pivot = world(...part.pivot);
      const geometry = toGeometry(buildVoxelMesh({ ...model, voxels: part.voxels, parts: undefined }, v));
      geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
      return [{ name: p.name, preset: p.preset, pivot, geometry }];
    });
    const isLit = (c: number) => model.keys[c] === 'flame' || model.keys[c] === 'glass';
    const lit = model.voxels.filter(([, , , c]) => isLit(c));
    const mean = (i: 0 | 1 | 2) => lit.reduce((s, vx) => s + vx[i], 0) / lit.length;
    const glowing = def.light !== undefined && lit.length > 0;
    out = {
      def,
      model,
      main: toGeometry(buildVoxelMesh({ ...model, parts: undefined, voxels: glowing ? model.voxels.filter(([, , , c]) => !isLit(c)) : model.voxels }, v)),
      glow: glowing ? toGeometry(buildVoxelMesh({ ...model, parts: undefined, voxels: lit }, v)) : null,
      parts,
      lightAt: lit.length ? world(mean(0), mean(1), mean(2)) : [0, H * v, 0],
    };
  }
  buildingCache.set(defId, out);
  return out;
}

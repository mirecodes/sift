import { BufferAttribute, BufferGeometry } from 'three';
import { withOverlay, type ModelColors } from '../../../shared/content/model';
import type { BlockPalette } from '../../../shared/content/palette';
import type { AnimalSkinDef, BlockThemeDef, BuildingDef } from '../../../shared/content/schema';
import { voxelModels } from '../../assets/voxels';
import { butterflyBody, butterflyWing } from '../../assets/voxels/butterfly';
import type { VoxelModel } from '../../assets/voxels/types';
import { content } from '../../domain/content';
import { DEFAULT_SKIN } from '../../domain/island/model';
import { defaultBlocks } from '../palette';
import { buildBlockMesh, buildVoxelMesh, type MeshData } from './meshData';

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

/** Species model with the skin's overlay voxels, if any. */
export function skinnedModel(modelId: string, skinId?: string): VoxelModel {
  const base = modelById(modelId);
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

const flutterCache = new Map<string, { body: BufferGeometry; wing: BufferGeometry }>();

/** Butterfly body and one wing (mirror it for the other), so the wings can flap (ADR-024). */
export function flutterParts(skinId: string = DEFAULT_SKIN) {
  const colors = skinColors(skinId);
  const key = colors ? skinId : DEFAULT_SKIN;
  let parts = flutterCache.get(key);
  if (!parts) {
    parts = {
      body: toGeometry(buildVoxelMesh(butterflyBody, VOXEL_SIZE, colors)),
      wing: toGeometry(buildVoxelMesh(butterflyWing, VOXEL_SIZE, colors)),
    };
    flutterCache.set(key, parts);
  }
  return parts;
}

export function modelById(modelId: string): VoxelModel {
  const model = voxelModels[modelId];
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
  flutterCache.clear();
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

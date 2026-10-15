import { buildPack, type ContentPack } from '../../../shared/content/pack';
import type { VoxelModel } from '../../../shared/content/model';
import { voxelModels } from '../../assets/voxels';

/**
 * The baseline content pack bundled with the app: every JSON file under `content/` plus the built-in
 * models. Vite bundles the files at build time, so a new data file needs no code change.
 */
const raw = import.meta.glob<unknown>('../../../content/**/*.json', { eager: true, import: 'default' });

const PREFIX = '../../../content/';
const META = new Set(['pack.json', 'presets.json']);

export function builtinModels(): Record<string, VoxelModel> {
  const out: Record<string, VoxelModel> = {};
  for (const [id, model] of Object.entries(voxelModels)) out[`species/${id}`] = model;
  return out;
}

export function contentFiles(): { path: string; data: unknown }[] {
  return Object.entries(raw)
    .map(([p, data]) => ({ path: p.slice(PREFIX.length), data }))
    .filter((f) => !META.has(f.path));
}

export const baselinePack: ContentPack = buildPack({
  contentVersion: (raw[`${PREFIX}pack.json`] as { contentVersion: string }).contentVersion,
  files: contentFiles(),
  models: builtinModels(),
});

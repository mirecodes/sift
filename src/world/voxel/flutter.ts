import type { Voxel, VoxelModel } from '../../../shared/content/model';

/**
 * `flutter` animals (ADR-024) are authored in their rest pose like any other model: the body in the two
 * center columns, the wings spread flat on both sides. The world draws the body and the left wing
 * (mirrored for the right one) as separate meshes so the wings can flap.
 */
export function flutterSplit(model: VoxelModel): { body: VoxelModel; wing: VoxelModel } {
  const [w, h, d] = model.size;
  const left = w / 2 - 1;
  const bodyVoxels = model.voxels.filter(([x]) => x >= left && x <= left + 1).map(([x, y, z, c]): Voxel => [x - left, y, z, c]);
  const wingRaw = model.voxels.filter(([x]) => x < left);
  const minY = Math.min(...wingRaw.map((v) => v[1]));
  const maxY = Math.max(...wingRaw.map((v) => v[1]));
  const wingVoxels = wingRaw.map(([x, y, z, c]): Voxel => [x, y - minY, z, c]);
  const base = { keys: model.keys, palette: model.palette };
  return {
    body: { ...base, size: [2, h, d], voxels: bodyVoxels },
    wing: { ...base, size: [left, maxY - minY + 1, d], voxels: wingVoxels },
  };
}

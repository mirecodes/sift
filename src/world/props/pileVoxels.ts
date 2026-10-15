/** Coin pile shape (DESIGN.md 15.6): a round heap of gold voxels on a 7×7 grid, one height per level. */
export const PILE_VOXEL = 0.12;
const RADIUS = 3;
/** Heap height at the center, in voxels, for levels 0..6. */
const PEAK = [0, 1.4, 2.2, 3, 4, 5, 6];

/** Voxel positions `[x, y, z]` in voxel units (x, z centered on the tile, y from the ground) for a pile level. */
export function pileVoxels(level: number): [number, number, number][] {
  const peak = PEAK[Math.max(0, Math.min(level, PEAK.length - 1))]!;
  const out: [number, number, number][] = [];
  for (let x = -RADIUS; x <= RADIUS; x++) {
    for (let z = -RADIUS; z <= RADIUS; z++) {
      const d = Math.hypot(x, z);
      if (d > RADIUS + 0.2) continue;
      const height = Math.round(peak - d);
      for (let y = 0; y < height; y++) out.push([x, y, z]);
    }
  }
  return out;
}

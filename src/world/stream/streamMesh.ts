import { config } from '../../domain/config';
import { levelTop, type StreamTile } from '../../domain/island/island';
import type { BlockPalette } from '../../../shared/content/palette';
import { defaultBlocks } from '../palette';
import { hexToLinearRgb, type MeshData } from '../voxel/meshData';

type P = [number, number, number];

/**
 * A spray emitter and the flow direction there: where water lands after a level step (`landing`), where it
 * leaves the island (`rim`: no floor, the spray keeps falling and dissolves) or the spring where it starts.
 */
export interface Splash {
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number;
  kind: 'landing' | 'rim' | 'spring';
}

/** Segments of the round head of the ribbon. */
const CAP = 8;

/** Plain typed arrays (no three.js), like the voxel mesh builder. Normals are computed by the caller. */
export interface StreamMeshData {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  splashes: Splash[];
  /** Smoothed centerline and the half width at each point (ground-plane x, z matter for the banks). */
  points: [number, number, number][];
  halves: number[];
}

/** Water surface height on a tile of the given terrain level. */
export const surfaceY = (level: number): number => levelTop(level) + 0.5 - config.stream.bedDepth + config.stream.waterDepth;

/** Chaikin corner cutting; keeps both ends. Rounds the tile-to-tile bends and the lip and foot of each fall. */
function smooth(points: P[], rounds: number): P[] {
  let pts = points;
  for (let r = 0; r < rounds; r++) {
    const out: P[] = [pts[0] as P];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i] as P;
      const b = pts[i + 1] as P;
      out.push(
        [0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1], 0.75 * a[2] + 0.25 * b[2]],
        [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1], 0.25 * a[2] + 0.75 * b[2]],
      );
    }
    out.push(pts[pts.length - 1] as P);
    pts = out;
  }
  return pts;
}

/**
 * Points of a fall that leaves the lip `from` on a horizontal tangent and drops `drop` blocks along a
 * parabola (x = D·t, y = −drop·t²), steepening toward the bottom. Returns the points after the lip.
 */
function fall(from: P, dx: number, dz: number, drop: number, steps: number): P[] {
  const run = 0.4 * Math.sqrt(drop);
  return Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps;
    return [from[0] + dx * run * t, from[1] - drop * t * t, from[2] + dz * run * t] as P;
  });
}

/** One ribbon for a run of stream tiles (upstream to downstream), with curved falls at level steps and at the rim. */
export function buildStreamMesh(run: readonly StreamTile[]): StreamMeshData {
  const splashes: Splash[] = [];
  const line: P[] = [];
  const at = (t: StreamTile): P => [t.x, surfaceY(t.level), t.z];
  const last = run.length - 1;

  // Where the previous fall ends, so a turn right after it starts beyond the foot instead of doubling back.
  let landed: { lip: P; dx: number; dz: number; run: number } | undefined;
  run.forEach((t, k) => {
    const y = surfaceY(t.level);
    const next = run[k + 1];
    const dx = next ? next.x - t.x : t.dx;
    const dz = next ? next.z - t.z : t.dz;
    const prev = run[k - 1];
    const [ax, az] = prev ? [t.x - prev.x, t.z - prev.z] : [dx, dz];
    if (ax === dx && az === dz) line.push(at(t));
    else {
      // A 90° bend is a quarter circle of radius 0.5 around the tile corner, from edge middle to edge middle.
      const [px, pz] = [t.x + (dx - ax) / 2, t.z + (dz - az) / 2];
      const [ux, uz, vx, vz] = [t.x - ax / 2 - px, t.z - az / 2 - pz, t.x + dx / 2 - px, t.z + dz / 2 - pz];
      for (let m = 0; m <= 6; m++) {
        const a = (m / 6) * (Math.PI / 2);
        const p: P = [px + ux * Math.cos(a) + vx * Math.sin(a), y, pz + uz * Math.cos(a) + vz * Math.sin(a)];
        if (landed && (p[0] - landed.lip[0]) * landed.dx + (p[2] - landed.lip[2]) * landed.dz < landed.run) continue;
        line.push(p);
      }
    }
    landed = undefined;
    const drop = next ? y - surfaceY(next.level) : config.stream.edgeDrop;
    if (drop <= 0) return;
    const lip: P = [t.x + dx / 2, y, t.z + dz / 2];
    const tail = line[line.length - 1] as P;
    if (Math.hypot(tail[0] - lip[0], tail[2] - lip[2]) > 1e-6) line.push(lip);
    const points = fall(lip, dx, dz, drop, k === last ? 6 : 4);
    line.push(...points);
    const foot = points[points.length - 1] as P;
    landed = { lip, dx, dz, run: 0.4 * Math.sqrt(drop) };
    splashes.push({ x: foot[0], y: foot[1], z: foot[2], dx, dz, kind: k === last ? 'rim' : 'landing' });
  });

  const first = run[0] as StreamTile;
  splashes.push({ x: first.x, y: surfaceY(first.level), z: first.z, dx: first.dx, dz: first.dz, kind: 'spring' });

  const pts = line.length > 1 ? smooth(line, 1) : line;
  // The ribbon has a round head at the spring: CAP + 1 extra rim vertices and a center vertex.
  const base = pts.length * 2;
  const positions = new Float32Array((base + CAP + 2) * 3);
  const uvs = new Float32Array((base + CAP + 2) * 2);
  const halves: number[] = [];
  let length = 0;
  let tx = 0;
  let tz = 1;
  const head = { tx: 0, tz: 1, half: 0 };
  pts.forEach((p, i) => {
    const prev = pts[Math.max(0, i - 1)] as P;
    const next = pts[Math.min(pts.length - 1, i + 1)] as P;
    const len = Math.hypot(next[0] - prev[0], next[2] - prev[2]);
    if (len > 1e-6) {
      tx = (next[0] - prev[0]) / len;
      tz = (next[2] - prev[2]) / len;
    }
    // On a tight bend the inner edge would cross itself, so the ribbon narrows to the turning radius.
    const half = Math.min(config.stream.width / 2, Math.max(0.1, 0.9 * turnRadius(prev, p, next)));
    halves.push(half);
    if (i === 0) Object.assign(head, { tx, tz, half });
    if (i > 0) length += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
    positions.set([p[0] - tz * half, p[1], p[2] + tx * half, p[0] + tz * half, p[1], p[2] - tx * half], i * 6);
    uvs.set([0, length, 1, length], i * 4);
  });

  const indices = new Uint32Array(Math.max(0, pts.length - 1) * 6 + CAP * 3);
  for (let i = 0; i < pts.length - 1; i++) {
    const l = i * 2;
    indices.set([l, l + 1, l + 2, l + 1, l + 3, l + 2], i * 6);
  }
  // Round head: a half disc behind the first point, so the pool at the spring is not cut off square.
  const p0 = pts[0] as P;
  positions.set(p0, base * 3);
  uvs.set([0.5, 0], base * 2);
  for (let m = 0; m <= CAP; m++) {
    const a = (m / CAP) * Math.PI;
    const [c, s] = [Math.cos(a) * head.half, Math.sin(a) * head.half];
    const v = base + 1 + m;
    positions.set([p0[0] - head.tz * c - head.tx * s, p0[1], p0[2] + head.tx * c - head.tz * s], v * 3);
    uvs.set([0.5 + 0.5 * Math.cos(a), -s], v * 2);
    if (m < CAP) indices.set([base, v, v + 1], (pts.length - 1) * 6 + m * 3);
  }
  return { positions, uvs, indices, splashes, points: pts, halves };
}

/** Approximate turning radius in the ground plane at `p` (arc length over turn angle). */
function turnRadius(a: P, p: P, b: P): number {
  const [ax, az, bx, bz] = [p[0] - a[0], p[2] - a[2], b[0] - p[0], b[2] - p[2]];
  const l1 = Math.hypot(ax, az);
  const l2 = Math.hypot(bx, bz);
  if (l1 < 1e-6 || l2 < 1e-6) return Infinity;
  const turn = Math.atan2(Math.abs(ax * bz - az * bx), ax * bx + az * bz);
  return turn < 1e-3 ? Infinity : (l1 + l2) / 2 / turn;
}

/** Each bed tile is sampled on a grid of this many cells per side to trace the bank outline. */
const GRID = 16;
/** The bank reaches this far under the ribbon edge, so no bed shows between water and bank. */
const OVERLAP = 0.03;
/** Height of the grassy lip at the top of the bank wall. */
const LIP = 0.07;

type V2 = { x: number; z: number };

/**
 * The bank around the water: for every bed tile, a grass surface at the surrounding height with the
 * channel cut out along the smooth ribbon edge (marching squares on the distance to the ribbon, so the
 * outline is a curve, not steps), plus a wall from the bank down to the bed along that edge.
 */
export function bankMesh(
  run: readonly StreamTile[],
  mesh: Pick<StreamMeshData, 'points' | 'halves'>,
  /** Surface height of the island tile at (x, z), or undefined past the rim. */
  surfaceAt: (x: number, z: number) => number | undefined = () => undefined,
  /** Block theme colors (Step 3.8). */
  blocks: BlockPalette = defaultBlocks,
): MeshData {
  const { points, halves } = mesh;
  // Distance from (x, z) to the ribbon edge: negative inside the water.
  const outside = (x: number, z: number): number => {
    let best = Infinity;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i] as P;
      const b = points[i + 1] as P;
      const [sx, sz] = [b[0] - a[0], b[2] - a[2]];
      const len2 = sx * sx + sz * sz;
      const t = len2 < 1e-9 ? 0 : Math.min(1, Math.max(0, ((x - a[0]) * sx + (z - a[2]) * sz) / len2));
      const half = (halves[i] as number) * (1 - t) + (halves[i + 1] as number) * t;
      best = Math.min(best, Math.hypot(x - (a[0] + sx * t), z - (a[2] + sz * t)) - half);
    }
    return best + OVERLAP;
  };

  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const grass = hexToLinearRgb(blocks.grassTop);
  const lip = hexToLinearRgb(blocks.grassSide);
  const dirt = hexToLinearRgb(blocks.dirtSide);
  const vertex = (x: number, y: number, z: number, n: readonly [number, number, number], c: readonly number[]): number => {
    positions.push(x, y, z);
    normals.push(...n);
    colors.push(...c);
    return positions.length / 3 - 1;
  };

  for (const tile of run) {
    const top = levelTop(tile.level) + 0.5;
    const bed = top - config.stream.bedDepth;
    const [x0, z0] = [tile.x - 0.5, tile.z - 0.5];
    const value: number[] = [];
    for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) value.push(outside(x0 + i / GRID, z0 + j / GRID));

    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => ({ x: x0 + (a as number) / GRID, z: z0 + (b as number) / GRID, v: value[(b as number) * (GRID + 1) + (a as number)] as number }));
        // Clip the cell to the bank side (v > 0); the two points where the edge crosses v = 0 bound the wall.
        const poly: V2[] = [];
        const walls: [V2, V2][] = [];
        let exit: V2 | undefined;
        let entry: V2 | undefined;
        for (let k = 0; k < 4; k++) {
          const cur = corners[k] as (typeof corners)[number];
          const next = corners[(k + 1) % 4] as (typeof corners)[number];
          if (cur.v > 0) poly.push(cur);
          if (cur.v > 0 === next.v > 0) continue;
          const t = cur.v / (cur.v - next.v);
          const p = { x: cur.x + (next.x - cur.x) * t, z: cur.z + (next.z - cur.z) * t };
          poly.push(p);
          if (cur.v > 0) exit = p;
          else if (exit) {
            walls.push([exit, p]);
            exit = undefined;
          } else entry = p;
        }
        if (exit && entry) walls.push([exit, entry]);

        // Where the tile side is exposed (no equally high neighbor), close the bank down to the bed block.
        const sides: [number, number, number, number, number][] = [
          [0, 1, 0, -1, j === 0 ? tile.z - 1 : NaN],
          [1, 2, 1, 0, i === GRID - 1 ? tile.x + 1 : NaN],
          [2, 3, 0, 1, j === GRID - 1 ? tile.z + 1 : NaN],
          [3, 0, -1, 0, i === 0 ? tile.x - 1 : NaN],
        ];
        for (const [ka, kb, nx, nz, nb] of sides) {
          if (Number.isNaN(nb)) continue;
          const [p, q] = [corners[ka] as (typeof corners)[number], corners[kb] as (typeof corners)[number]];
          if (p.v <= 0 || q.v <= 0) continue;
          const neighbor = nx === 0 ? surfaceAt(tile.x, nb) : surfaceAt(nb, tile.z);
          if (neighbor !== undefined && neighbor >= top - 1e-6) continue;
          const n = [nx, 0, nz] as const;
          const mid = top - LIP;
          const [a, b, c, d, f, g] = [
            vertex(p.x, top, p.z, n, lip), vertex(q.x, top, q.z, n, lip),
            vertex(p.x, mid, p.z, n, lip), vertex(q.x, mid, q.z, n, lip),
            vertex(p.x, bed, p.z, n, dirt), vertex(q.x, bed, q.z, n, dirt),
          ] as const;
          const [c2, d2] = [vertex(p.x, mid, p.z, n, dirt), vertex(q.x, mid, q.z, n, dirt)];
          indices.push(a, b, c, b, d, c, c2, d2, f, d2, g, f);
        }

        if (poly.length >= 3) {
          const ids = poly.map((p) => vertex(p.x, top, p.z, [0, 1, 0], grass));
          for (let k = 1; k < ids.length - 1; k++) indices.push(ids[0] as number, ids[k] as number, ids[k + 1] as number);
        }
        for (const [p, q] of walls) {
          // The wall faces the water: against the gradient of the distance.
          const [mx, mz, e] = [(p.x + q.x) / 2, (p.z + q.z) / 2, 0.02];
          const [gx, gz] = [outside(mx + e, mz) - outside(mx - e, mz), outside(mx, mz + e) - outside(mx, mz - e)];
          const len = Math.hypot(gx, gz);
          if (len < 1e-9) continue;
          const n = [-gx / len, 0, -gz / len] as const;
          const mid = top - LIP;
          const [a, b, c, d, f, g] = [
            vertex(p.x, top, p.z, n, lip), vertex(q.x, top, q.z, n, lip),
            vertex(p.x, mid, p.z, n, lip), vertex(q.x, mid, q.z, n, lip),
            vertex(p.x, bed, p.z, n, dirt), vertex(q.x, bed, q.z, n, dirt),
          ] as const;
          const [c2, d2] = [vertex(p.x, mid, p.z, n, dirt), vertex(q.x, mid, q.z, n, dirt)];
          indices.push(a, b, c, b, d, c, c2, d2, f, d2, g, f);
        }
      }
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors), indices: new Uint32Array(indices) };
}

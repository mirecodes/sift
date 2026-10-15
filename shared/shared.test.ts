import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BALANCE_VERSION, balance } from './balance/balance';
import { seededRng } from './rng';
import { pickPlacementTile } from './rules/placement';
import { pickSpecies, rollReward, tierProbabilities } from './rules/reward';

const ROOT = dirname(fileURLToPath(import.meta.url));
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sources(p);
    return p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
  });

describe('shared/ stays portable (guidance_v2 §2.7)', () => {
  it.each(sources(ROOT).map((p) => [relative(ROOT, p), p]))('%s has no platform globals and imports only shared/', (_, path) => {
    const code = readFileSync(path as string, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(code).not.toMatch(/Math\.random|Date\.now|\bwindow\b|\bdocument\b|\blocalStorage\b|\bindexedDB\b|\bprocess\.|\bDeno\b/);
    for (const [, spec] of code.matchAll(/from '([^']+)'/g)) {
      expect(spec?.startsWith('.'), `${spec} must be a relative import`).toBe(true);
      expect(resolve(dirname(path as string), spec as string).startsWith(ROOT), `${spec} leaves shared/`).toBe(true);
    }
  });
});

describe('balance (guidance_v2 §2.6)', () => {
  it('has a version and is deeply frozen', () => {
    expect(BALANCE_VERSION).toMatch(/\S/);
    expect(Object.isFrozen(balance)).toBe(true);
    expect(Object.isFrozen(balance.reward.tierAtMin)).toBe(true);
    expect(Object.isFrozen(balance.timer.focusMinutes)).toBe(true);
  });

  it('keeps the current reward odds and timer limits', () => {
    expect(balance.reward).toEqual({ minFocusMs: 25 * 60_000, maxFocusMs: 60 * 60_000, tierAtMin: [0.6, 0.28, 0.1, 0.02], tierAtMax: [0.5, 0.32, 0.14, 0.04] });
    expect(balance.timer).toEqual({ focusMinutes: { default: 25, min: 5, max: 60, step: 5 }, breakMinutes: { default: 5, min: 1, max: 30, step: 1 } });
    for (const odds of [balance.reward.tierAtMin, balance.reward.tierAtMax]) expect(odds.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
});

describe('seeded rng', () => {
  it('is deterministic per seed and in [0, 1)', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(seededRng(43)()).not.toBe(xs[0]);
  });
});

describe('shared reward rule', () => {
  const catalog = [
    { id: 'a', tierRank: 0 as const },
    { id: 'b', tierRank: 0 as const },
    { id: 'c', tierRank: 3 as const },
  ];

  it('works on any catalog and is reproducible from a seed', () => {
    const roll = (seed: number) => Array.from({ length: 50 }, ((rng) => () => rollReward(30 * 60_000, catalog, rng)?.id)(seededRng(seed)));
    expect(roll(7)).toEqual(roll(7));
    expect(rollReward(24 * 60_000, catalog, seededRng(1))).toBeUndefined();
    expect(pickSpecies(catalog, 3, () => 0.5).id).toBe('c');
    expect(pickSpecies(catalog, 2, () => 0.5).id).toBe('a'); // empty tier: first entry
    expect(tierProbabilities(25 * 60_000)).toEqual([0.6, 0.28, 0.1, 0.02]);
  });
});

describe('shared placement rule', () => {
  const tiles = [
    { x: 0, z: 0 },
    { x: 1, z: 0, water: true },
    { x: 3, z: 3 },
    { x: -1, z: 0 },
  ];

  it('never picks water or blocked tiles', () => {
    const rng = seededRng(5);
    for (let i = 0; i < 200; i++) expect(pickPlacementTile(tiles, [{ x: 0, z: 0 }], rng)).not.toMatchObject({ x: 0, z: 0 });
    for (let i = 0; i < 200; i++) expect(pickPlacementTile(tiles, [], rng)).not.toMatchObject({ x: 1, z: 0 });
    expect(pickPlacementTile(tiles, [{ x: 0, z: 0 }, { x: 3, z: 3 }, { x: -1, z: 0 }], rng)).toBeUndefined();
  });

  it('prefers the center and is reproducible from a seed', () => {
    const counts = new Map<string, number>();
    const rng = seededRng(9);
    for (let i = 0; i < 5000; i++) {
      const t = pickPlacementTile(tiles, [], rng)!;
      counts.set(`${t.x},${t.z}`, (counts.get(`${t.x},${t.z}`) ?? 0) + 1);
    }
    expect(counts.get('0,0')!).toBeGreaterThan(counts.get('3,3')! * 3);
    const run = (seed: number) => Array.from({ length: 20 }, ((r) => () => pickPlacementTile(tiles, [], r))(seededRng(seed)));
    expect(run(3)).toEqual(run(3));
  });
});

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rgbToHex, hslToRgb } from '../../shared/content/color';
import { PALETTE_KEYS } from '../../shared/content/palette';
import { PIVOT_INDEX, voxToModel } from './import';
import { readVox, writeVox, type VoxScene } from './vox';

const ROOT = 'content/models';
export const TEMPLATE = join(ROOT, 'palette-template.vox');

/** One swatch voxel per palette key in a row (index i at x = i - 1), plus the pivot marker. */
export function templateScene(): VoxScene {
  const palette = ['#000000'];
  PALETTE_KEYS.forEach((_, i) => palette.push(rgbToHex(hslToRgb({ h: (i * 137.5) % 360, s: 0.55, l: 0.55 }))));
  while (palette.length < 256) palette.push('#000000');
  palette[PIVOT_INDEX] = '#FF00FF';
  const voxels: [number, number, number, number][] = PALETTE_KEYS.map((_, i) => [i, 0, 0, i + 1]);
  voxels.push([0, 2, 0, PIVOT_INDEX]);
  return { palette, objects: [{ t: [0, 0, 0], model: { size: [PALETTE_KEYS.length, 3, 1], voxels } }] };
}

const voxFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return voxFiles(p);
    return p.endsWith('.vox') && p !== TEMPLATE ? [p] : [];
  });

/**
 * `npm run content:vox`: converts every `content/models/**\/*.vox` to model JSON next to it.
 * `npm run content:vox -- --template` (re)writes the palette template.
 */
export function main(args: string[]): number {
  if (args.includes('--template')) {
    writeFileSync(TEMPLATE, writeVox(templateScene()));
    console.log(`wrote ${TEMPLATE}`);
    return 0;
  }
  const files = voxFiles(ROOT);
  for (const f of files) {
    const model = voxToModel(readVox(new Uint8Array(readFileSync(f))), { file: f });
    const out = f.replace(/\.vox$/, '.json');
    writeFileSync(out, `${JSON.stringify(model)}\n`);
    console.log(`${f} → ${out}`);
  }
  if (!files.length) console.log(`no .vox files under ${ROOT}`);
  return 0;
}

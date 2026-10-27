import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ModelColors } from '../../shared/content/model';
import type { PackItem } from '../../shared/content/pack';
import { baselinePack } from '../../src/domain/content/baseline';
import { formatContentJson } from './format';

/**
 * `npm run content:new -- <kind> <id> [options]`: creates the files of a new item from a template, in
 * the layout `content/` expects (docs/guides/CONTENT.md). Kinds:
 *
 *   animal <id> [--tier common|mythic|epic|legendary]   content/animals/<id>/animal.json + model.ts
 *   skin <animalId> <skinId>                             content/animals/<animalId>/skins/<skinId>.json
 *   theme <id>                                           content/themes/<id>.json
 *   building <id> [--size 1x1]                           content/buildings/<id>/building.json + model.ts
 *   family <id>                                          content/skin-families/<id>.json
 *   release <id> [--date YYYY-MM-DD]                     content/releases/<id>.json
 *
 * Common options: --en "English name" --ko "한국어 이름" --release <id> (default: the newest release)
 * --price <gold>. Never overwrites a file.
 */

const TIERS = ['common', 'mythic', 'epic', 'legendary'] as const;
/** Template model height per tier (inside DESIGN.md 16.2: 3–5, 5–7, 7–10, 10–12). */
const TEMPLATE_HEIGHT = [4, 6, 8, 10];

export interface ScaffoldContext {
  items: readonly PackItem[];
  /** Default colors of every animal model, by species id (skins start from them). */
  animalPalettes: Readonly<Record<string, ModelColors>>;
  today: string;
}

export interface NewFile {
  /** Relative to `content/`. */
  path: string;
  text: string;
}

const title = (id: string) => id.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

function parseArgs(args: readonly string[]): { positional: string[]; options: Record<string, string> } {
  const positional: string[] = [];
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('--')) options[a.slice(2)] = args[++i] ?? '';
    else positional.push(a);
  }
  return { positional, options };
}

function animalModel(name: string, tierRank: number): string {
  const h = TEMPLATE_HEIGHT[tierRank]!;
  const leg = Math.max(1, Math.floor(h / 4));
  const head = 2;
  return `import { defineModel } from '../../../tools/content-build/animal';

// ${name}: placeholder shape from \`npm run content:new\`. Replace it with the real model (builder calls
// below, or a MagicaVoxel file saved as model.vox + \`npm run content:vox\`; docs/guides/CONTENT.md).
// Size [width, height, depth] in voxels; the animal faces +z. Height ${h} fits its tier.
export default defineModel([4, ${h}, 5], {
  1: ['body', '#C8A27A'], // fur
  2: ['belly', '#F2E6D8'], // muzzle
  3: ['eye', '#1E1E1E'], // eyes (always #1E1E1E)
}, (b) => {
  b.boxM(0, 0, 0, 1, ${leg}, 1, 1); // back legs
  b.boxM(0, 0, 3, 1, ${leg}, 1, 1); // front legs
  b.box(0, ${leg}, 0, 4, ${h - leg - head}, 4, 1); // body
  b.box(0, ${h - head}, 3, 4, ${head}, 2, 1); // head
  b.box(1, ${h - head}, 4, 2, 1, 1, 2); // muzzle
  b.setM(0, ${h - 1}, 4, 3); // eyes
});
`;
}

function buildingModel(name: string, w: number, d: number): string {
  return `import { model } from '../../../tools/content-build/dsl';

// ${name}: placeholder crate from \`npm run content:new\`. One footprint tile is 8 voxels; height ≤ 24.
// Replace the shapes below (docs/guides/CONTENT.md §3.2).
export default model([${w * 8}, 8, ${d * 8}], { wood: '#B98552', woodDark: '#8A5A36' }, (m) => {
  m.paint('woodDark');
  m.box(0, 0, 0, ${w * 8}, 1, ${d * 8});
  m.paint('wood');
  m.box(1, 1, 1, ${w * 8 - 2}, 6, ${d * 8 - 2});
});
`;
}

/** The files for a new item, or a message saying why not. Pure: `main` writes them. */
export function scaffold(args: readonly string[], ctx: ScaffoldContext): NewFile[] | string {
  const { positional, options } = parseArgs(args);
  const [kind, id, second] = positional;
  const usage = 'usage: npm run content:new -- <animal|skin|theme|building|family|release> <id> [options] (see tools/content-build/new.ts)';
  if (!kind || !id) return usage;
  const itemId = kind === 'skin' ? second : id;
  if (!itemId || !/^[a-z][a-z0-9_-]*$/.test(itemId)) return `ids are lowercase: a-z, 0-9, _ or - (${usage})`;
  if (ctx.items.some((i) => i.id === itemId)) return `an item with id ${itemId} already exists`;

  const releases = ctx.items.filter((i): i is Extract<PackItem, { kind: 'release' }> => i.kind === 'release');
  const newest = [...releases].sort((a, b) => b.date.localeCompare(a.date))[0]?.id ?? 'base';
  const release = options.release ?? newest;
  if (kind !== 'release' && !releases.some((r) => r.id === release)) return `unknown release ${release}`;
  const en = options.en ?? title(itemId);
  const name = { en, ko: options.ko ?? en };
  const price = (fallback: number) => (options.price ? Number(options.price) : fallback);
  const json = (path: string, data: unknown): NewFile => ({ path, text: formatContentJson(data) });

  switch (kind) {
    case 'animal': {
      const tierRank = TIERS.indexOf((options.tier ?? 'common') as (typeof TIERS)[number]);
      if (tierRank < 0) return `--tier is one of ${TIERS.join(', ')}`;
      return [
        json(`animals/${id}/animal.json`, { kind: 'species', id, name, tierRank, idle: tierRank === 3 ? 'sparkle' : 'default', model: `animals/${id}`, release }),
        { path: `animals/${id}/model.ts`, text: animalModel(en, tierRank) },
      ];
    }
    case 'skin': {
      const palette = ctx.animalPalettes[id];
      if (!palette) return `unknown animal ${id}`;
      const { eye: _eye, ...colors } = palette;
      return [json(`animals/${id}/skins/${itemId}.json`, { kind: 'animalSkin', id: itemId, name, price: price(60), purchasable: true, release, speciesId: id, palette: colors })];
    }
    case 'theme': {
      const base = ctx.items.find((i) => i.id === 'default');
      if (base?.kind !== 'blockTheme') return 'the default theme is missing';
      return [json(`themes/${id}.json`, { kind: 'blockTheme', id, name, price: price(150), purchasable: true, release, palette: base.palette })];
    }
    case 'building': {
      const m = (options.size ?? '1x1').match(/^([1-3])x([1-3])$/);
      if (!m) return '--size is WxD tiles, each 1 to 3 (e.g. 2x1)';
      const [w, d] = [Number(m[1]), Number(m[2])];
      return [
        json(`buildings/${id}/building.json`, { kind: 'building', id, name, price: price(20), purchasable: true, release, category: 'decor', footprint: { w, d }, model: `buildings/${id}`, rotatable: true }),
        { path: `buildings/${id}/model.ts`, text: buildingModel(en, w, d) },
      ];
    }
    case 'family':
      return [json(`skin-families/${id}.json`, { kind: 'skinFamily', id, name, release, purchasable: true, priceByTierRank: [25, 30, 40, 55], transform: { hueShift: 30 } })];
    case 'release':
      return [json(`releases/${id}.json`, { kind: 'release', id, date: options.date ?? ctx.today, name, featured: [] })];
    default:
      return usage;
  }
}

export function main(args: string[]): number {
  const animalPalettes = Object.fromEntries(
    baselinePack.items.flatMap((i) => (i.kind === 'species' && baselinePack.models[i.model] ? [[i.id, baselinePack.models[i.model]!.palette]] : [])),
  );
  const files = scaffold(args, { items: baselinePack.items, animalPalettes, today: new Date().toISOString().slice(0, 10) });
  if (typeof files === 'string') {
    console.error(files);
    return 1;
  }
  const root = join(process.cwd(), 'content');
  const taken = files.filter((f) => existsSync(join(root, f.path)));
  if (taken.length) {
    console.error(`already exists: ${taken.map((f) => f.path).join(', ')}`);
    return 1;
  }
  for (const f of files) {
    mkdirSync(dirname(join(root, f.path)), { recursive: true });
    writeFileSync(join(root, f.path), f.text);
    console.log(`created content/${f.path}`);
  }
  console.log('Next: edit the files (names in en + ko, colors, model), preview in /studio, then `npm run content:sprites` and `npm run content:validate`.');
  return 0;
}

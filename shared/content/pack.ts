import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from './color';
import type { ModelColors, VoxelModel } from './model';
import type { PaletteKey } from './palette';
import type { AtlasIndex } from './sprites';
import {
  ContentFile,
  type AnimalSkinDef,
  type ContentDef,
  type ItemDef,
  type PaletteTransform,
  type ReleaseDef,
  type SkinFamilyDef,
  type SpeciesDef,
} from './schema';

/** The sprite atlas (Step 3.5): image URL plus `SPRITE_SIZE` frames by item id. */
export interface Atlas extends AtlasIndex {
  image: string;
}

export type PackItem = SpeciesDef | ItemDef | ReleaseDef;

/** Behavior presets are code (Step 3.2); items reference them by id within one kind. */
export type PresetKind = 'idle' | 'part' | 'particles' | 'light';
export type PresetIds = Readonly<Record<PresetKind, readonly string[]>>;

/** A content pack (guidance_v2 Step 3.1): the app bundles a baseline pack; newer ones arrive remotely (Step 5.8). */
export interface ContentPack {
  contentVersion: string;
  /** Species, skins (families expanded), themes, buildings and releases, in a stable order. */
  items: readonly PackItem[];
  models: Readonly<Record<string, VoxelModel>>;
  atlas?: Atlas;
}

export interface PackSource {
  contentVersion: string;
  /** Parsed JSON files under `content/` (one item or an array per file), path relative to `content/`. */
  files: readonly { path: string; data: unknown }[];
  models: Readonly<Record<string, VoxelModel>>;
  /** Known code preset ids by kind (`content/presets.json`, Step 3.2); omitted = not checked. */
  presets?: PresetIds;
  atlas?: Atlas;
}

export class ContentError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid content:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ContentError';
  }
}

/** Compares `2026-10-07.2`-style versions number by number. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/\D+/).filter(Boolean).map(Number);
  const pb = b.split(/\D+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

const transformColor = (hex: string, t: PaletteTransform): string => {
  const hsl = rgbToHsl(hexToRgb(hex));
  const h = (((hsl.h + (t.hueShift ?? 0)) % 360) + 360) % 360;
  const s = Math.min(1, hsl.s * (t.saturation ?? 1));
  const l = Math.min(1, Math.max(0, t.lightness ? t.lightness.offset + t.lightness.scale * hsl.l : hsl.l));
  let rgb = hslToRgb({ h, s, l });
  if (t.tint) {
    const c = hexToRgb(t.tint.color);
    rgb = rgb.map((v, i) => v + ((c[i] as number) - v) * t.tint!.amount) as [number, number, number];
  }
  return rgbToHex(rgb);
};

/** Applies a family transform to a species' default palette. */
export function transformPalette(palette: ModelColors, t: PaletteTransform): Partial<Record<PaletteKey, string>> {
  const keep = new Set<PaletteKey>(t.keep ?? ['eye']);
  const out: Partial<Record<PaletteKey, string>> = {};
  for (const [key, color] of Object.entries(palette) as [PaletteKey, string][]) {
    if (keep.has(key)) continue;
    out[key] = t.fixed?.[key] ?? transformColor(color, t);
  }
  return out;
}

/** One skin per species, id `family:speciesId`, in catalog order (Step 3.1). */
export function expandFamily(family: SkinFamilyDef, species: readonly SpeciesDef[], models: Readonly<Record<string, VoxelModel>>): AnimalSkinDef[] {
  return species.map((s) => {
    const model = models[s.model];
    if (!model) throw new ContentError([`${s.id}: model ${s.model} not found`]);
    const o = family.overrides?.[s.id];
    const skin: AnimalSkinDef = {
      kind: 'animalSkin',
      id: `${family.id}:${s.id}`,
      speciesId: s.id,
      family: family.id,
      name: { en: `${family.name.en} ${s.name.en}`, ko: `${family.name.ko} ${s.name.ko}` },
      price: o?.price ?? family.priceByTierRank[s.tierRank],
      purchasable: family.purchasable,
      release: family.release,
      palette: { ...transformPalette(model.palette, family.transform), ...o?.palette },
    };
    if (o?.overlay) skin.overlay = o.overlay;
    for (const k of ['availableFrom', 'availableUntil', 'minClientVersion', 'tags'] as const) {
      if (family[k] !== undefined) (skin as Record<string, unknown>)[k] = family[k];
    }
    return skin;
  });
}

/**
 * Where each kind of item lives under `content/` (one folder per animal and building, one file per
 * other item). The folder or file name is the item id, so copy-paste mistakes fail loudly.
 */
const LAYOUT: readonly [RegExp, ContentDef['kind'], (m: RegExpMatchArray, d: ContentDef) => string | null][] = [
  [/^animals\/([^/]+)\/animal\.json$/, 'species', (m, d) => (d.id === m[1] ? null : `id must be ${m[1]} (the folder name)`)],
  [/^animals\/([^/]+)\/skins\/([^/]+)\.json$/, 'animalSkin', (m, d) =>
    d.id !== m[2] ? `id must be ${m[2]} (the file name)` : d.kind === 'animalSkin' && d.speciesId !== m[1] ? `speciesId must be ${m[1]} (the animal folder)` : null],
  [/^buildings\/([^/]+)\/building\.json$/, 'building', (m, d) => (d.id === m[1] ? null : `id must be ${m[1]} (the folder name)`)],
  [/^themes\/([^/]+)\.json$/, 'blockTheme', (m, d) => (d.id === m[1] ? null : `id must be ${m[1]} (the file name)`)],
  [/^skin-families\/([^/]+)\.json$/, 'skinFamily', (m, d) => (d.id === m[1] ? null : `id must be ${m[1]} (the file name)`)],
  [/^releases\/([^/]+)\.json$/, 'release', (m, d) => (d.id === m[1] ? null : `id must be ${m[1]} (the file name)`)],
];

/** Why an item does not belong at this path, or null. Paths outside the known layout are not checked. */
export function layoutProblem(path: string, def: ContentDef): string | null {
  for (const [re, kind, check] of LAYOUT) {
    const m = path.match(re);
    if (!m) continue;
    return def.kind === kind ? check(m, def) : `a ${def.kind} does not belong in ${path} (expected a ${kind})`;
  }
  return null;
}

/**
 * Validates every file and assembles a pack: schemas, unique ids, references (species, models,
 * releases, presets), family expansion. Returns every problem; invalid entries are left out of the
 * pack (the Content Studio keeps working while a file is broken).
 */
export function assemblePack(src: PackSource): { pack: ContentPack; problems: string[] } {
  const problems: string[] = [];
  const defs: ContentDef[] = [];
  for (const { path, data } of [...src.files].sort((a, b) => a.path.localeCompare(b.path))) {
    const list = Array.isArray(data) ? data : [data];
    list.forEach((entry, i) => {
      const parsed = ContentFile.safeParse(entry);
      const where = list.length > 1 ? `${path}[${i}]` : path;
      if (!parsed.success) {
        for (const issue of parsed.error.issues) problems.push(`${where}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
        return;
      }
      const misplaced = layoutProblem(path, parsed.data);
      if (misplaced) problems.push(`${where}: ${misplaced}`);
      else defs.push(parsed.data);
    });
  }

  const of = <K extends ContentDef['kind']>(kind: K) => defs.filter((d): d is Extract<ContentDef, { kind: K }> => d.kind === kind);
  // Catalog order: by tier, then file path (one folder per animal: by id).
  const species = of('species').sort((a, b) => a.tierRank - b.tierRank);
  const families = of('skinFamily');
  const releases = of('release');

  let skins: AnimalSkinDef[] = of('animalSkin');
  for (const f of families) {
    try {
      skins = skins.concat(expandFamily(f, species.filter((s) => src.models[s.model]), src.models));
    } catch (e) {
      problems.push(...(e instanceof ContentError ? e.problems : [String(e)]));
    }
  }
  // Shop and picker order: oldest release first (the free defaults come first), then by id.
  const released = new Map(releases.map((r) => [r.id, r.date]));
  const byRelease = <T extends { id: string; release: string }>(list: T[]) =>
    [...list].sort((a, b) => (released.get(a.release) ?? '').localeCompare(released.get(b.release) ?? '') || a.id.localeCompare(b.id));
  const items: PackItem[] = [...species, ...byRelease(skins), ...byRelease(of('blockTheme')), ...byRelease(of('building')), ...releases];

  const invalid = new Set<string>();
  const bad = (id: string, message: string) => {
    invalid.add(id);
    problems.push(`${id}: ${message}`);
  };
  const seen = new Set<string>();
  const duplicates = new Set<object>();
  for (const entry of [...items, ...families]) {
    if (seen.has(entry.id)) {
      problems.push(`duplicate id ${entry.id}`);
      duplicates.add(entry);
    }
    seen.add(entry.id);
  }
  const speciesIds = new Set(species.map((s) => s.id));
  const releaseIds = new Set(releases.map((r) => r.id));
  const model = (owner: string, ref: string | undefined) => {
    if (ref && !src.models[ref]) bad(owner, `model ${ref} not found`);
  };
  const preset = (owner: string, kind: PresetKind, id: string | undefined) => {
    if (id && src.presets && !src.presets[kind].includes(id)) bad(owner, `unknown ${kind} preset ${id}`);
  };
  for (const f of families) {
    if (!releaseIds.has(f.release)) bad(f.id, `unknown release ${f.release}`);
    for (const id of Object.keys(f.overrides ?? {})) if (!speciesIds.has(id)) bad(f.id, `override for unknown species ${id}`);
  }
  for (const item of items) {
    if (item.kind !== 'release' && !releaseIds.has(item.release)) bad(item.id, `unknown release ${item.release}`);
    switch (item.kind) {
      case 'species':
        model(item.id, item.model);
        preset(item.id, 'idle', item.idle);
        break;
      case 'animalSkin':
        if (!speciesIds.has(item.speciesId)) bad(item.id, `unknown species ${item.speciesId}`);
        model(item.id, item.overlay);
        break;
      case 'blockTheme':
        preset(item.id, 'particles', item.ambient);
        break;
      case 'building':
        model(item.id, item.model);
        preset(item.id, 'light', item.light);
        for (const p of item.parts ?? []) {
          preset(item.id, 'part', p.preset);
          if (src.models[item.model] && !src.models[item.model]!.parts?.[p.name]) bad(item.id, `model ${item.model} has no part ${p.name}`);
        }
        break;
      case 'release':
        for (const id of item.featured) if (!seen.has(id)) bad(item.id, `featured item ${id} not found`);
        break;
    }
  }
  const kept = items.filter((i) => !invalid.has(i.id) && !duplicates.has(i) && !(i.kind === 'animalSkin' && i.family && invalid.has(i.family)));
  const usedModels = new Set(kept.flatMap((i) => ('model' in i ? [i.model] : 'overlay' in i && i.overlay ? [i.overlay] : [])));
  const models = Object.fromEntries(Object.entries(src.models).filter(([ref]) => usedModels.has(ref)));
  return { pack: { contentVersion: src.contentVersion, items: kept, models, ...(src.atlas ? { atlas: src.atlas } : {}) }, problems };
}

/** Validates and builds; throws one `ContentError` listing every problem. */
export function buildPack(src: PackSource): ContentPack {
  const { pack, problems } = assemblePack(src);
  if (problems.length) throw new ContentError(problems);
  return pack;
}

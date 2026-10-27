import { z } from 'zod';
import { BLOCK_PALETTE_KEYS, PALETTE_KEYS } from './palette';

/**
 * Content data files (`content/`, guidance_v2 §2.13, Step 3.1). Every species, skin, skin family,
 * block theme, building and release is JSON validated by these schemas. Game code reads items only
 * through the ContentRegistry.
 */

const Id = z.string().regex(/^[a-z][a-z0-9_-]*(:[a-z][a-z0-9_-]*)?$/, 'ids are lowercase: a-z, 0-9, _ or -');
const Color = z.string().regex(/^#[0-9A-F]{6}$/, 'colors are #RRGGBB, upper case');
/** Date or date-time in ISO 8601, e.g. 2026-11-01 or 2026-11-01T00:00:00Z. */
const IsoDate = z.string().refine((s) => /^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s)), 'not an ISO date');
const Version = z.string().regex(/^\d+\.\d+\.\d+$/, 'versions are x.y.z');
const Locale = z.object({ en: z.string().min(1), ko: z.string().min(1) }).strict();
const PaletteKey = z.enum(PALETTE_KEYS);
const Palette = z.partialRecord(PaletteKey, Color);
/** Key into the pack's models, e.g. `animals/tiger` or `buildings/windmill`: the item folder's `model.ts` / `model.json`, or a loose model under `content/models/`. */
export const ModelRef = z.string().regex(/^[a-z]+\/[a-z0-9_-]+$/);
/** Id of a code preset (Step 3.2); checked against `content/presets.json` by `buildPack`. */
const PresetId = z.string().regex(/^[a-z][a-z0-9_]*$/);

const itemBase = {
  id: Id,
  name: Locale,
  price: z.number().int().positive().optional(),
  purchasable: z.boolean(),
  release: Id,
  availableFrom: IsoDate.optional(),
  availableUntil: IsoDate.optional(),
  minClientVersion: Version.optional(),
  tags: z.array(z.string().min(1)).optional(),
};

export const SpeciesDef = z.object({
  kind: z.literal('species'),
  id: Id,
  name: Locale,
  tierRank: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  /** Idle animation set preset. */
  idle: PresetId,
  model: ModelRef,
  release: Id,
}).strict();

export const AnimalSkinDef = z.object({
  ...itemBase,
  kind: z.literal('animalSkin'),
  speciesId: Id,
  family: Id.optional(),
  palette: Palette,
  /** Extra voxels drawn over the species model (hat, wings, …). */
  overlay: ModelRef.optional(),
}).strict();

export const PaletteTransform = z.object({
  /** Degrees added to every hue. */
  hueShift: z.number().min(-360).max(360).optional(),
  /** Multiplies saturation. */
  saturation: z.number().min(0).max(4).optional(),
  /** Lightness curve L' = offset + scale × L (L in 0..1). */
  lightness: z.object({ offset: z.number().min(-1).max(1), scale: z.number().min(0).max(2) }).strict().optional(),
  /** Blends every result toward this color by `amount`. */
  tint: z.object({ color: Color, amount: z.number().min(0).max(1) }).strict().optional(),
  /** Fixed color per key (wins over the curve). */
  fixed: Palette.optional(),
  /** Keys left untouched (default: `eye`). */
  keep: z.array(PaletteKey).optional(),
}).strict();
export type PaletteTransform = z.infer<typeof PaletteTransform>;

export const SkinFamilyDef = z.object({
  kind: z.literal('skinFamily'),
  id: Id,
  name: Locale,
  transform: PaletteTransform,
  priceByTierRank: z.tuple([z.number().int().positive(), z.number().int().positive(), z.number().int().positive(), z.number().int().positive()]),
  release: Id,
  purchasable: z.boolean().default(true),
  availableFrom: IsoDate.optional(),
  availableUntil: IsoDate.optional(),
  minClientVersion: Version.optional(),
  tags: z.array(z.string().min(1)).optional(),
  /** Per-species changes, e.g. a different palette for one animal. */
  overrides: z.record(Id, z.object({ palette: Palette.optional(), overlay: ModelRef.optional(), price: z.number().int().positive().optional() }).strict()).optional(),
}).strict();

export const BlockThemeDef = z.object({
  ...itemBase,
  kind: z.literal('blockTheme'),
  palette: z.record(z.enum(BLOCK_PALETTE_KEYS), Color),
  cloudTint: Color.optional(),
  /** Ambient particle preset, e.g. `snow`. */
  ambient: PresetId.optional(),
  /** Colors repeated over the top blocks in diagonal bands, multiplied with the block colors (rainbow ground). */
  tileTints: z.array(Color).min(2).max(12).optional(),
  /** `glossy`: blocks catch a specular highlight (glass, metal). Default matte. */
  finish: z.enum(['matte', 'glossy']).optional(),
}).strict();

export const BuildingDef = z.object({
  ...itemBase,
  kind: z.literal('building'),
  category: z.enum(['decor', 'structure', 'nature', 'light', 'special']),
  footprint: z.object({ w: z.number().int().min(1), d: z.number().int().min(1) }).strict(),
  model: ModelRef,
  rotatable: z.boolean(),
  allowOnWater: z.boolean().optional(),
  parts: z.array(z.object({ name: z.string().min(1), preset: PresetId }).strict()).optional(),
  light: PresetId.optional(),
}).strict();

export const ReleaseDef = z.object({
  kind: z.literal('release'),
  id: Id,
  /** Day the release goes out (drives the shop's New badge). */
  date: IsoDate,
  name: Locale,
  /** Items shown in the shop's Featured row while this is the newest release. */
  featured: z.array(Id),
}).strict();

export const ContentFile = z.discriminatedUnion('kind', [SpeciesDef, AnimalSkinDef, SkinFamilyDef, BlockThemeDef, BuildingDef, ReleaseDef]);

export type SpeciesDef = z.infer<typeof SpeciesDef>;
export type AnimalSkinDef = z.infer<typeof AnimalSkinDef>;
export type SkinFamilyDef = z.infer<typeof SkinFamilyDef>;
export type BlockThemeDef = z.infer<typeof BlockThemeDef>;
export type BuildingDef = z.infer<typeof BuildingDef>;
export type ReleaseDef = z.infer<typeof ReleaseDef>;
export type ContentDef = z.infer<typeof ContentFile>;
/** What the shop sells and the inventory owns. */
export type ItemDef = AnimalSkinDef | BlockThemeDef | BuildingDef;
export type ItemKind = ItemDef['kind'];

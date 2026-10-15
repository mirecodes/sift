/**
 * Named palette keys (guidance_v2 Step 3.0). Models paint voxels with a key, never a raw color,
 * so skins and block themes recolor them by key. Keys are shared by every model.
 */
export const PALETTE_KEYS = [
  // Animals
  'body', 'body2', 'belly', 'muzzle', 'accent', 'accent2', 'accent3',
  'eye', 'nose', 'beak', 'horn', 'wing', 'shell', 'mane', 'prop', 'prop2',
  'rainbow1', 'rainbow2', 'rainbow3', 'rainbow4', 'rainbow5',
  // Buildings and decorations
  'wood', 'woodDark', 'roof', 'stone', 'stoneDark', 'metal', 'leaf', 'leafDark', 'flower', 'flower2',
  'cloth', 'cloth2', 'glass', 'flame', 'water',
] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

/** Terrain and camp colors one block theme sets (DESIGN.md 14). */
export const BLOCK_PALETTE_KEYS = [
  'grassTop', 'grassSide', 'dirtTop', 'dirtSide', 'stoneTop', 'stoneSide',
  'water', 'waterStreak',
  'cabinLog', 'cabinLogDark', 'cabinBeam', 'cabinRoof', 'cabinRoofDark', 'campStone', 'campStoneDark', 'firewood',
] as const;
export type BlockPaletteKey = (typeof BLOCK_PALETTE_KEYS)[number];
export type BlockPalette = Readonly<Record<BlockPaletteKey, string>>;

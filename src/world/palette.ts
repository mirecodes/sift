import type { BlockPalette } from '../../shared/content/palette';
import type { BlockThemeDef } from '../../shared/content/schema';
import { content } from '../domain/content';

/** Terrain and camp colors by named key (Step 3.0): the `default` block theme (`content/themes/default.json`). */
export const defaultBlocks: BlockPalette = (content.get('default') as BlockThemeDef).palette;

/** World colors (DESIGN.md 14). Never shared with UI tokens. */
export const palette = {
  skyTop: '#9FD8FF',
  skyBottom: '#EAF6FF',
  cloud: '#FFFFFF',
  cloudOpacity: 0.9,
  shadow: '#000000',
  splash: '#FFFFFF',
  coin: '#F2C230',
  coinDark: '#D9A21E',
  puff: '#EEEEEE',
  /** Build mode footprint tint (DESIGN.md 15.7). */
  buildOk: '#5ED67A',
  buildBad: '#FF5A5F',
} as const;

/**
 * One directional light from the top-left plus a soft ambient (DESIGN.md 17).
 * The direction is chosen so that, in the isometric view, the top face is lightest,
 * the left (+Z) face medium and the right (+X) face darkest.
 */
export const lighting = {
  ambient: 0.45,
  directional: 0.669,
  direction: [0.224, 0.822, 0.523] as const,
  /** Three.js lights are in physical units; Lambert divides by π. */
  intensityScale: Math.PI,
};

/** Night mode (DESIGN.md 15.4). Blended with the day values by a 0..1 `night` factor. */
export const night = {
  skyTop: '#070B24',
  skyBottom: '#1F2C5C',
  cloud: '#4A5A8C',
  cloudOpacity: 0.35,
  ambientColor: '#7F8FD8',
  ambient: 0.32,
  directionalColor: '#93A8FF',
  directional: 0.28,
  fire: '#FF9A3C',
} as const;

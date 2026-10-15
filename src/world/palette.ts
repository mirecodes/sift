/** World colors (DESIGN.md 14). Never shared with UI tokens. */
export const palette = {
  skyTop: '#9FD8FF',
  skyBottom: '#EAF6FF',
  cloud: '#FFFFFF',
  cloudOpacity: 0.9,
  grass: { top: '#7BC950', side: '#5FA83E' },
  dirt: { top: '#9B6B43', side: '#86593A' },
  stone: { top: '#8A8F98', side: '#747983' },
  shadow: '#000000',
  water: '#4FA8E8',
  waterStreak: '#9AD4FF',
  splash: '#FFFFFF',
  coin: '#F2C230',
  puff: '#EEEEEE',
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

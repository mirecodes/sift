import type { PresetIds } from '../../../shared/content/pack';
import { LIGHT_PRESETS } from './lights';
import { PART_PRESETS } from './parts';
import { FIELD_PRESETS, RainbowBursts, Sparkles } from './particles';

/**
 * Behavior presets (guidance_v2 §2.13, Step 3.2): reusable code referenced by id from content.
 * `content/presets.json` lists the same ids so content validation can reject unknown ones; a test
 * keeps both in sync. A new preset is a code change shipped with an app release, and items using it
 * set `minClientVersion`.
 */

/** Idle animation sets for species. `flop` and `flutter` are motion styles handled by `Animals`. */
export const IDLE_PRESETS = {
  default: { effects: [] },
  flop: { effects: [] },
  flutter: { effects: [] },
  sparkle: { effects: ['sparkle'] },
  rainbow: { effects: ['sparkle', 'rainbow'] },
} as const satisfies Record<string, { effects: readonly ('sparkle' | 'rainbow')[] }>;
export type IdlePresetId = keyof typeof IDLE_PRESETS;

export const PRESET_IDS: PresetIds = {
  idle: Object.keys(IDLE_PRESETS),
  part: Object.keys(PART_PRESETS),
  particles: ['sparkle', 'rainbow', ...Object.keys(FIELD_PRESETS)],
  light: Object.keys(LIGHT_PRESETS),
};

/** Particle effects of an idle set, drawn around the animal. */
export function IdleEffects({ idle, timeScale, reducedMotion }: { idle: IdlePresetId; timeScale: number; reducedMotion: boolean }) {
  const effects: readonly string[] = IDLE_PRESETS[idle].effects;
  return (
    <>
      {effects.includes('sparkle') && <Sparkles timeScale={timeScale} reducedMotion={reducedMotion} />}
      {effects.includes('rainbow') && !reducedMotion && <RainbowBursts timeScale={timeScale} />}
    </>
  );
}

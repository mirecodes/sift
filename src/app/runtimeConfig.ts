import { parse } from 'yaml';
import raw from '../../config/app.yaml?raw';

/** Feature flags (guidance_v2 §0.2): each phase ships behind one, off until the owner turns it on. */
export const FEATURES = [
  'stats',
  'economy',
  'cosmetics',
  'islandMove',
  'remoteContent',
  'friends',
  'presence',
  'together',
  'visitTraceProp',
  'groups',
  'missions',
  'war',
  'arrange',
  'liveProgress',
] as const;
export type Feature = (typeof FEATURES)[number];

export interface RuntimeConfig {
  resetMapOnStart: boolean;
  testMode: { enabled: boolean; speciesCount: number; allSpecies: boolean };
  features: Record<Feature, boolean>;
}

type ConfigFile = Partial<{
  resetMapOnStart: boolean;
  testMode: Partial<RuntimeConfig['testMode']>;
  features: Partial<Record<string, boolean>>;
}>;

/**
 * Developer switches are honored only in development builds; production forces them off.
 * Feature flags come from the file in every build; `forced` (the `VITE_FEATURES` build variable,
 * comma-separated or `all`) turns extra ones on for test builds such as the e2e smoke test.
 */
export function resolveRuntimeConfig(file: ConfigFile, isDev: boolean, forced = ''): RuntimeConfig {
  const on = new Set(forced.split(',').map((f) => f.trim()));
  const features = Object.fromEntries(
    FEATURES.map((f) => [f, file.features?.[f] === true || on.has(f) || on.has('all')]),
  ) as Record<Feature, boolean>;
  return {
    resetMapOnStart: isDev && file.resetMapOnStart === true,
    testMode: {
      enabled: isDev && file.testMode?.enabled === true,
      speciesCount: Math.max(1, Math.floor(file.testMode?.speciesCount ?? 4)),
      allSpecies: file.testMode?.allSpecies === true,
    },
    features,
  };
}

export const runtimeConfig = resolveRuntimeConfig(
  (parse(raw) ?? {}) as ConfigFile,
  import.meta.env.DEV,
  (import.meta.env.VITE_FEATURES as string | undefined) ?? '',
);

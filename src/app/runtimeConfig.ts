import { parse } from 'yaml';
import raw from '../../config/app.yaml?raw';

export interface RuntimeConfig {
  resetMapOnStart: boolean;
  testMode: { enabled: boolean; speciesCount: number; allSpecies: boolean };
}

type ConfigFile = Partial<{ resetMapOnStart: boolean; testMode: Partial<RuntimeConfig['testMode']> }>;

/** Developer switches are honored only in development builds; production forces them off. */
export function resolveRuntimeConfig(file: ConfigFile, isDev: boolean): RuntimeConfig {
  return {
    resetMapOnStart: isDev && file.resetMapOnStart === true,
    testMode: {
      enabled: isDev && file.testMode?.enabled === true,
      speciesCount: Math.max(1, Math.floor(file.testMode?.speciesCount ?? 4)),
      allSpecies: file.testMode?.allSpecies === true,
    },
  };
}

export const runtimeConfig = resolveRuntimeConfig((parse(raw) ?? {}) as ConfigFile, import.meta.env.DEV);

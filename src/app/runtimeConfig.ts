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
  /** Developer switches (ADR-015, ADR-019, ADR-038). */
  testMode: {
    resetMapOnStart: boolean;
    animals: { enabled: boolean; speciesCount: number; allSpecies: boolean };
    dummyData: boolean;
    /** Start signed in to the test backend as `tester@example.com` (fake backend only). */
    signedIn: boolean;
  };
  features: Record<Feature, boolean>;
  /** Phase 5 backend (docs/guides/BACKEND_SETUP.md). */
  backend: BackendConfig;
  /** Where shared links point (Step 6.5); empty = this page's origin (web). */
  links: { origin: string };
}

export type BackendConfig =
  | { provider: 'none' }
  | { provider: 'fake' }
  | { provider: 'supabase'; supabaseUrl: string; supabaseAnonKey: string };

type ConfigFile = Partial<{
  testMode: Partial<{
    resetMapOnStart: boolean;
    animals: Partial<RuntimeConfig['testMode']['animals']>;
    dummyData: boolean;
    signedIn: boolean;
  }>;
  features: Partial<Record<string, boolean>>;
  backend: Partial<{ provider: string; supabaseUrl: string; supabaseAnonKey: string }>;
  links: Partial<{ origin: string }>;
}>;

/** `backend` from the file; `forcedBackend` (`VITE_BACKEND`) overrides the provider. Incomplete Supabase settings mean none. */
export function resolveBackend(file: ConfigFile['backend'], forcedBackend = ''): BackendConfig {
  const provider = forcedBackend || file?.provider || 'none';
  if (provider === 'fake') return { provider: 'fake' };
  if (provider === 'supabase' && file?.supabaseUrl && file.supabaseAnonKey) return { provider: 'supabase', supabaseUrl: file.supabaseUrl, supabaseAnonKey: file.supabaseAnonKey };
  return { provider: 'none' };
}

/** Features that only work with an account server. */
const ONLINE_FEATURES: readonly Feature[] = ['friends', 'presence', 'together', 'visitTraceProp', 'groups', 'missions', 'war'];

/**
 * Developer switches (`testMode`) are honored only in development builds; production forces them off.
 * Feature flags come from the file in every build; `forced` (the `VITE_FEATURES` build variable,
 * comma-separated or `all`) turns extra ones on for test builds such as the e2e smoke test.
 * Development builds only: mode `all` (`npm run dev:all`) turns on every flag, the test backend, sample
 * data and the signed-in start; and an online feature without a backend gets the test backend.
 */
export function resolveRuntimeConfig(file: ConfigFile, isDev: boolean, forced = '', forcedBackend = '', mode = ''): RuntimeConfig {
  const all = isDev && mode === 'all';
  const on = new Set(forced.split(',').map((f) => f.trim()));
  const features = Object.fromEntries(
    FEATURES.map((f) => [f, file.features?.[f] === true || on.has(f) || on.has('all') || all]),
  ) as Record<Feature, boolean>;
  const t = file.testMode;
  let backend = resolveBackend(file.backend, forcedBackend || (all ? 'fake' : ''));
  if (isDev && backend.provider === 'none' && ONLINE_FEATURES.some((f) => features[f])) backend = { provider: 'fake' };
  return {
    testMode: {
      resetMapOnStart: isDev && t?.resetMapOnStart === true,
      animals: {
        enabled: isDev && t?.animals?.enabled === true,
        speciesCount: Math.max(1, Math.floor(t?.animals?.speciesCount ?? 4)),
        allSpecies: t?.animals?.allSpecies === true,
      },
      dummyData: isDev && (t?.dummyData === true || all),
      signedIn: isDev && (t?.signedIn === true || all),
    },
    features,
    backend,
    links: { origin: typeof file.links?.origin === 'string' ? file.links.origin.replace(/\/+$/, '') : '' },
  };
}

export const runtimeConfig = resolveRuntimeConfig(
  (parse(raw) ?? {}) as ConfigFile,
  import.meta.env.DEV,
  (import.meta.env.VITE_FEATURES as string | undefined) ?? '',
  (import.meta.env.VITE_BACKEND as string | undefined) ?? '',
  import.meta.env.MODE,
);

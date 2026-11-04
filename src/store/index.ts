import { useStore } from 'zustand';
import { CATALOG } from '../domain/animals/catalog';
import { createDummyData } from '../app/devDummy';
import { runtimeConfig } from '../app/runtimeConfig';
import { APP_VERSION } from '../app/version';
import { platform } from '../platform';
import { createRemote } from '../platform/remote/create';
import { createAppStore, type AppState } from './appStore';

const { testMode, features, backend } = runtimeConfig;
const { animals } = testMode;
// Every species, or a random subset chosen once per page load.
const testSpecies = animals.enabled
  ? animals.allSpecies
    ? [...CATALOG]
    : [...CATALOG].sort(() => Math.random() - 0.5).slice(0, animals.speciesCount)
  : undefined;

export const appStore = createAppStore({
  storage: platform.storage,
  now: () => Date.now(),
  rng: () => Math.random(),
  uuid: () => crypto.randomUUID(),
  testSpecies,
  resetMap: testMode.resetMapOnStart,
  // The DEV check lets the bundler drop the sample data from production builds.
  dummy: import.meta.env.DEV && testMode.dummyData ? createDummyData(Date.now()) : undefined,
  economy: features.economy,
  clientVersion: APP_VERSION,
  remote: createRemote(backend, { platform: platform.name, appVersion: APP_VERSION, secure: platform.secure, sampleFriends: import.meta.env.DEV && testMode.dummyData }),
  remoteContent: features.remoteContent,
  push: platform.push,
  platformName: platform.name,
  locale: typeof navigator === 'undefined' ? 'en' : navigator.language,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});

export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}

export * from './appStore';

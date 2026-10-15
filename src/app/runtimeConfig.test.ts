import { describe, expect, it } from 'vitest';
import { resolveRuntimeConfig } from './runtimeConfig';

const allOn = { resetMapOnStart: true, testMode: { enabled: true, speciesCount: 4, allSpecies: true } };

describe('resolveRuntimeConfig', () => {
  it('forces developer switches off in production builds', () => {
    const c = resolveRuntimeConfig(allOn, false);
    expect(c.resetMapOnStart).toBe(false);
    expect(c.testMode.enabled).toBe(false);
  });

  it('honors developer switches in development builds', () => {
    const c = resolveRuntimeConfig(allOn, true);
    expect(c.resetMapOnStart).toBe(true);
    expect(c.testMode.enabled).toBe(true);
  });

  it('defaults to off when the file is empty', () => {
    const c = resolveRuntimeConfig({}, true);
    expect(c.resetMapOnStart).toBe(false);
    expect(c.testMode.enabled).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { resolveRuntimeConfig } from './runtimeConfig';

const allOn = { testMode: { resetMapOnStart: true, animals: { enabled: true, speciesCount: 4, allSpecies: true }, dummyData: true } };

describe('resolveRuntimeConfig', () => {
  it('forces developer switches off in production builds', () => {
    const c = resolveRuntimeConfig(allOn, false);
    expect(c.testMode.resetMapOnStart).toBe(false);
    expect(c.testMode.animals.enabled).toBe(false);
    expect(c.testMode.dummyData).toBe(false);
  });

  it('honors developer switches in development builds', () => {
    const c = resolveRuntimeConfig(allOn, true);
    expect(c.testMode.resetMapOnStart).toBe(true);
    expect(c.testMode.animals.enabled).toBe(true);
    expect(c.testMode.dummyData).toBe(true);
  });

  it('defaults to off when the file is empty', () => {
    const c = resolveRuntimeConfig({}, true);
    expect(c.testMode.resetMapOnStart).toBe(false);
    expect(c.testMode.animals.enabled).toBe(false);
    expect(c.testMode.dummyData).toBe(false);
    expect(Object.values(c.features).every((on) => !on)).toBe(true);
  });

  it('reads feature flags from the file in every build', () => {
    expect(resolveRuntimeConfig({ features: { stats: true } }, false).features.stats).toBe(true);
    expect(resolveRuntimeConfig({ features: { stats: true } }, false).features.friends).toBe(false);
  });

  it('turns flags on from the build variable (`all` or a list)', () => {
    expect(resolveRuntimeConfig({}, false, 'stats, groups').features).toMatchObject({ stats: true, groups: true, friends: false });
    expect(Object.values(resolveRuntimeConfig({}, false, 'all').features).every(Boolean)).toBe(true);
  });

  it('keeps every flag and developer switch off in the committed config', async () => {
    const { parse } = await import('yaml');
    const { readFileSync } = await import('node:fs');
    const file = parse(readFileSync(new URL('../../config/app.yaml', import.meta.url), 'utf8'));
    const c = resolveRuntimeConfig(file, true);
    expect(Object.values(c.features).some(Boolean)).toBe(false);
    expect([c.testMode.resetMapOnStart, c.testMode.animals.enabled, c.testMode.dummyData].some(Boolean)).toBe(false);
  });
});

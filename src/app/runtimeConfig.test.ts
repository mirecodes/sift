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

  it('keeps every flag off in the committed config', async () => {
    const { parse } = await import('yaml');
    const { readFileSync } = await import('node:fs');
    const file = parse(readFileSync(new URL('../../config/app.yaml', import.meta.url), 'utf8'));
    expect(Object.values(resolveRuntimeConfig(file, false).features).some(Boolean)).toBe(false);
  });
});

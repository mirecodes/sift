import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { baselinePack } from '../../src/domain/content/baseline';

/**
 * `npm run content:build`: validates `content/` (building the pack throws on any problem) and writes
 * the pack JSON to `dist-content/` for publishing (Step 5.8). The app bundles the same pack itself.
 */
export function main(args: string[]): number {
  const out = args[0] ?? 'dist-content';
  mkdirSync(out, { recursive: true });
  const file = join(out, `pack-${baselinePack.contentVersion}.json`);
  writeFileSync(file, JSON.stringify(baselinePack));
  const kinds = new Map<string, number>();
  for (const i of baselinePack.items) kinds.set(i.kind, (kinds.get(i.kind) ?? 0) + 1);
  console.log(`${file}: ${[...kinds].map(([k, n]) => `${n} ${k}`).join(', ')}, ${Object.keys(baselinePack.models).length} models`);
  return 0;
}

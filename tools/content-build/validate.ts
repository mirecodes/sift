import { balance } from '../../shared/balance/balance';
import { assemblePack } from '../../shared/content/pack';
import { validateContent } from '../../shared/content/validate';
import { baselineAtlas, builtinModels, contentFiles, presetIds } from '../../src/domain/content/baseline';

/** Every problem in `content/`: schema, references, presets, budgets, prices, dates and sprites. */
export function contentProblems(): string[] {
  const { pack, problems } = assemblePack({
    contentVersion: 'validate',
    files: contentFiles(),
    models: builtinModels(),
    presets: presetIds,
  });
  return [
    ...problems,
    ...validateContent(pack, { prices: balance.prices, ...(baselineAtlas ? { atlas: baselineAtlas } : {}) }),
    ...(baselineAtlas ? [] : ['content/sprites/atlas.json is missing (run npm run content:sprites)']),
  ];
}

/** `npm run content:validate` (CI runs it on every commit, Step 3.5). Exit code 1 on any problem. */
export function main(): number {
  const problems = contentProblems();
  for (const p of problems) console.error(`✗ ${p}`);
  console.log(problems.length ? `${problems.length} content problems` : 'content is valid');
  return problems.length ? 1 : 0;
}

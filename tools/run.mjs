// Runs a TypeScript tool module through Vite's module runner (same resolution as the app,
// `import.meta.glob` included) and calls its `main(args)`.
// Usage: node tools/run.mjs tools/content-build/build.ts [args…]
import { resolve } from 'node:path';
import { runnerImport } from 'vite';

const [entry, ...args] = process.argv.slice(2);
const { module } = await runnerImport(resolve(entry), { configFile: false, logLevel: 'error' });
try {
  const code = await module.main(args);
  process.exit(code ?? 0);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

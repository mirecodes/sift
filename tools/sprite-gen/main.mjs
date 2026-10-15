// npm run content:sprites (guidance_v2 Step 3.5): renders every sprite in headless Chromium (the same
// Playwright setup as `npm run e2e`) through the dev server's `/studio/sprites` page and writes
// content/sprites/atlas.png + atlas.json.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5196;
const OUT = 'content/sprites';
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => server.kill());
for (let i = 0; i < 150; i++) {
  if (await fetch(`http://localhost:${PORT}`).then((r) => r.ok, () => false)) break;
  await new Promise((r) => setTimeout(r, 200));
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${PORT}/studio/sprites`);
await page.waitForFunction(() => typeof window.__renderAtlas === 'function', null, { timeout: 60_000 });
const { png, index } = await page.evaluate(() => window.__renderAtlas());
await browser.close();
server.kill();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/atlas.png`, Buffer.from(png.split(',')[1], 'base64'));
// One frame per line, sorted by id: stable, readable diffs.
const lines = Object.entries(index.frames)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, f]) => `    ${JSON.stringify(id)}: ${JSON.stringify(f)}`);
writeFileSync(`${OUT}/atlas.json`, `{\n  "size": ${index.size},\n  "width": ${index.width},\n  "height": ${index.height},\n  "frames": {\n${lines.join(',\n')}\n  }\n}\n`);
console.log(`${OUT}/atlas.png: ${lines.length} sprites`);
process.exit(0);

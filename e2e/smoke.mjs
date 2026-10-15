// Browser smoke test: npm run e2e (build first: npm run build).
// Uses a fake clock, so a 25 minute session takes a few seconds.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4179;
const URL = `http://localhost:${PORT}`;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);

for (let i = 0; i < 50; i++) {
  if (await fetch(URL).then((r) => r.ok, () => false)) break;
  await new Promise((r) => setTimeout(r, 200));
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.clock.install();

let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed++;
};
const timer = () => page.getByRole('timer').innerText();
const settle = (ms = 700) => page.waitForTimeout(ms);
const startVisible = () => page.getByRole('button', { name: 'Start focus' }).isVisible();

await page.goto(URL);
await settle(1500);
await page.getByRole('button', { name: 'Start focus' }).click();
await settle(500);
await page.clock.fastForward('10:00');
await settle();
check('timer follows the clock after a 10 minute jump', /^1[45]:\d\d$/.test(await timer()));

await page.reload();
await settle(1500);
check('reload restores the running focus', /^1[45]:\d\d$/.test(await timer()));

await page.mouse.move(640, 400);
await settle(400);
const box = await page.getByRole('button', { name: 'Hold to stop' }).boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.clock.fastForward(1600);
await settle(400);
await page.mouse.up();
await settle();
check('holding for 1.5s abandons and returns Home', await startVisible());

await page.getByRole('button', { name: 'Start focus' }).click();
await settle(500);
await page.mouse.move(600, 400);
await settle(400);
const box2 = await page.getByRole('button', { name: 'Hold to stop' }).boundingBox();
await page.mouse.move(box2.x + 20, box2.y + 20);
await page.mouse.down();
await page.clock.fastForward(500);
await page.mouse.up();
await settle(300);
check('a short press does not abandon', (await timer()).length === 5);

await page.keyboard.down('Escape');
await page.clock.fastForward(1600);
await settle(400);
await page.keyboard.up('Escape');
await settle();
check('holding Esc abandons', await startVisible());

await page.keyboard.press('Space');
await settle();
check('Space starts focus', (await timer()).length === 5);
await page.clock.fastForward('26:00');
await settle();
check('overtime shows +mm:ss', (await timer()).startsWith('+'));
await page.keyboard.press('Space');
await settle(1200);
check('Space ends focus into the break', await page.getByText('Break', { exact: true }).isVisible());
await page.clock.fastForward('05:10');
await settle();
check('break over shows the ready prompt', await page.getByText('Ready for the next one?').isVisible());
await page.getByRole('button', { name: 'Home' }).click();
await settle(1000);
await page.getByRole('button', { name: 'Open collection' }).click();
await settle();
const collected = /^[1-9]\d* \/ 50$/;
check('collection counts the new animal', await page.getByText(collected).isVisible());
await page.reload();
await settle(1500);
await page.getByRole('button', { name: 'Open collection' }).click();
await settle();
check('saved animals survive a reload (developer switches off in production)', await page.getByText(collected).isVisible());
await page.getByRole('button', { name: 'Close' }).click();
await page.getByRole('button', { name: 'Open settings' }).click();
await page.getByRole('button', { name: 'Increase Focus length' }).click();
await page.getByRole('button', { name: 'Decrease Break length' }).click();
await page.getByRole('button', { name: 'Close' }).click();
await page.reload();
await settle(1500);
check('settings persist across a reload', (await page.locator('p', { hasText: /30 min focus/i }).count()) > 0);

// Backup: export, then import into a fresh context (same as cleared site data).
const exportFrom = async (p) => {
  await p.getByRole('button', { name: 'Open settings' }).click();
  const [download] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Export', exact: true }).click()]);
  const file = await download.path();
  await p.getByRole('button', { name: 'Close' }).click();
  return file;
};
const { readFile } = await import('node:fs/promises');
const backupFile = await exportFrom(page);
const original = JSON.parse(await readFile(backupFile, 'utf8'));
check('export downloads a sift-backup v1 file', original.format === 'sift-backup' && original.version === 1);

const fresh = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })).newPage();
fresh.on('pageerror', (e) => errors.push(e.message));
await fresh.goto(URL);
await fresh.waitForTimeout(1500);
await fresh.getByRole('button', { name: 'Open settings' }).click();
const [chooser] = await Promise.all([fresh.waitForEvent('filechooser'), fresh.getByRole('button', { name: 'Import…' }).click()]);
await chooser.setFiles(backupFile);
await fresh.waitForTimeout(500);
check('import shows a summary before replacing', await fresh.getByText(/^Backup from .*: \d+ sessions?, 1 animal\.$/).isVisible());
await fresh.getByRole('button', { name: 'Replace data' }).click();
await fresh.waitForTimeout(500);
await fresh.getByRole('button', { name: 'Close' }).click();
await fresh.waitForTimeout(700);
check('import restores settings', (await fresh.locator('p', { hasText: /30 min focus/i }).count()) > 0);
const restored = JSON.parse(await readFile(await exportFrom(fresh), 'utf8'));
check('import restores every store exactly', JSON.stringify(restored.data) === JSON.stringify(original.data));
await fresh.reload();
await fresh.waitForTimeout(1500);
await fresh.getByRole('button', { name: 'Open collection' }).click();
await fresh.waitForTimeout(700);
check('imported island survives a reload', await fresh.getByText(collected).isVisible());
await fresh.getByRole('button', { name: 'Close' }).click();

// Inbox: a queued notice shows on Home, one at a time, and OK dismisses it for good.
const withNotices = structuredClone(original);
const departed = (id, at, gold) => ({ id, createdAt: at, notice: { kind: 'animals_departed', animalIds: ['x', 'y'], gold } });
withNotices.data.inbox = [departed('n1', 1, 4), departed('n2', 2, 9)];
const { writeFile } = await import('node:fs/promises');
const noticeFile = `${backupFile}.notices.json`;
await writeFile(noticeFile, JSON.stringify(withNotices));
await fresh.getByRole('button', { name: 'Open settings' }).click();
const [chooser2] = await Promise.all([fresh.waitForEvent('filechooser'), fresh.getByRole('button', { name: 'Import…' }).click()]);
await chooser2.setFiles(noticeFile);
await fresh.waitForTimeout(300);
await fresh.getByRole('button', { name: 'Replace data' }).click();
await fresh.waitForTimeout(300);
await fresh.getByRole('button', { name: 'Close' }).click();
await fresh.waitForTimeout(700);
check('the oldest notice shows on Home', await fresh.getByRole('status').getByText('2 animals left 4 gold.').isVisible());
await fresh.getByRole('button', { name: 'OK' }).click();
await fresh.waitForTimeout(400);
check('OK shows the next notice', await fresh.getByRole('status').getByText('2 animals left 9 gold.').isVisible());
await fresh.getByRole('button', { name: 'OK' }).click();
await fresh.waitForTimeout(400);
await fresh.reload();
await fresh.waitForTimeout(1500);
check('dismissed notices stay gone after a reload', (await fresh.getByRole('status').count()) === 0);

check('no page errors', errors.length === 0);
if (errors.length) console.log(errors.join('\n'));

await browser.close();
stop();
process.exit(failed ? 1 : 0);

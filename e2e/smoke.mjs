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
check('no page errors', errors.length === 0);
if (errors.length) console.log(errors.join('\n'));

await browser.close();
stop();
process.exit(failed ? 1 : 0);

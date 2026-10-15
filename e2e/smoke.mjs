// Browser smoke test: npm run e2e (builds a production bundle with the finished feature flags into dist-e2e).
// Uses a fake clock, so a 25 minute session takes a few seconds.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4179;
const URL = `http://localhost:${PORT}`;
const server = spawn('npx', ['vite', 'preview', '--outDir', 'dist-e2e', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);

for (let i = 0; i < 50; i++) {
  if (await fetch(URL).then((r) => r.ok, () => false)) break;
  await new Promise((r) => setTimeout(r, 200));
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
// Count WebGL draw calls, to prove covered tabs consume no frames.
await page.addInitScript(() => {
  window.__draws = 0;
  for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const original = proto[name];
      if (original)
        proto[name] = function (...args) {
          window.__draws++;
          return original.apply(this, args);
        };
    }
  }
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// Start at 10:00 today: the run fast-forwards about an hour, and day-based checks (Stats) must not cross midnight.
const morning = new Date();
morning.setHours(10, 0, 0, 0);
await page.clock.install({ time: morning });

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

// Tabs: the canvas stays mounted and draws nothing while Stats covers it.
const tabs = page.getByRole('navigation', { name: 'Main' });
const draws = () => page.evaluate(() => window.__draws);
await page.evaluate(() => (document.querySelector('canvas').dataset.mark = 'kept'));
await tabs.getByRole('button', { name: 'Stats' }).click();
await settle();
const before = await draws();
await settle(1000);
check('Stats covers the canvas and it draws no frames', (await draws()) === before);
const monthLabel = () => page.locator('[aria-live="polite"]').first().innerText();
const thisMonth = await monthLabel();
const next = page.getByRole('button', { name: 'Next month' });
check('Stats shows the daily average for this month, no future months', (await page.getByText('Daily average').isVisible()) && (await next.isDisabled()));
await page.getByRole('button', { name: 'Previous month' }).click();
check('the month selector goes back', (await monthLabel()) !== thisMonth && (await next.isEnabled()));
await next.click();
check('and forward again', (await monthLabel()) === thisMonth);
const weekLabel = () => page.locator('[aria-live="polite"]').nth(1).innerText();
const nextWeek = page.getByRole('button', { name: 'Next week' });
const thisWeek = await weekLabel();
const dayButtons = page.getByRole('button', { name: /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day \d+ \w+: / });
const daysInMonth = await page.evaluate(() => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
check('the month calendar and the week show one button per day, no future weeks', (await dayButtons.count()) === daysInMonth + 7 && (await nextWeek.isDisabled()));
await page.getByRole('button', { name: 'Previous week' }).click();
check('week navigation goes back and forward', (await weekLabel()) !== thisWeek && (await nextWeek.click(), (await weekLabel()) === thisWeek));
await page.keyboard.press('Space');
await settle();
check('Space does nothing on the Stats tab', (await page.getByRole('timer').count()) === 0);
await tabs.getByRole('button', { name: 'Island' }).click();
await settle();
check('back on Island the same canvas renders again', (await draws()) > before && (await page.locator('canvas[data-mark="kept"]').count()) === 1);

// Economy HUD (Phase 2): the label carries the number. With cosmetics (Phase 3) gold opens the Shop.
const goldButton = page.getByRole('button', { name: /gold\. Open shop$/ });
const goldShown = async () => Number((await goldButton.getAttribute('aria-label')).split(' ')[0]);
check('Home shows the 30 starter gold and no Unicorns', (await goldShown()) === 30 && (await page.getByRole('img', { name: '0 Unicorns on the island' }).isVisible()));
await goldButton.click();
await settle(500);
check('tapping gold opens the shop', await page.getByRole('heading', { name: 'Shop' }).isVisible());
await page.getByRole('button', { name: 'Close' }).click();
await settle(500);

await page.getByRole('button', { name: 'Start focus' }).click();
await settle(500);
await page.clock.fastForward('10:00');
await settle();
check('timer follows the clock after a 10 minute jump', /^1[45]:\d\d$/.test(await timer()));
check('the tab bar is hidden during Focus', (await tabs.count()) === 0);
check('the HUD is hidden during Focus', (await goldButton.count()) === 0);

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
check('the tab bar is back on Break', await tabs.isVisible());
await tabs.getByRole('button', { name: 'Stats' }).click();
await settle();
const pill = page.getByRole('button', { name: /^Break \d\d:\d\d$/ });
check('other tabs show the running break in a pill', await pill.isVisible());
await pill.click();
await settle();
check('the pill returns to the break on Island', await page.getByRole('timer').isVisible());
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
// Cosmetics (Phase 3): the theme picker shows the default theme equipped; a collected card opens its skins.
check('the island theme picker shows Meadow equipped', (await page.getByRole('button', { name: 'Meadow', pressed: true }).count()) === 1);
await page.getByRole('button', { name: /: choose a skin$/ }).first().click();
await settle(400);
check('a species sheet lists Default as equipped and skins to buy', (await page.getByRole('dialog').getByText('Equipped').count()) === 1 && (await page.getByRole('dialog').getByRole('button', { name: 'Open shop' }).count()) >= 5);
await page.keyboard.press('Escape');
await settle(300);
await page.getByRole('button', { name: 'Close' }).click();

// Day detail: today has two stopped sessions and one completed with a reward.
await tabs.getByRole('button', { name: 'Stats' }).click();
await settle();
const today = page.getByRole('button', { name: /day \d+ \w+: \d+m, 1 session$/ }).first();
check('today counts only the completed session', await today.isVisible());
await today.click();
await settle(500);
const sheet = page.getByRole('dialog');
check(
  'the day sheet lists every session, stopped ones marked, with the reward',
  (await sheet.getByText(/^Stopped after/).count()) === 2 && (await sheet.getByRole('img').count()) === 1 && (await sheet.getByText(/^\d\d:\d\d$/).count()) === 3,
);
await page.keyboard.press('Escape');
await settle(300);
check('Esc closes the day sheet', (await page.getByRole('dialog').count()) === 0);
await tabs.getByRole('button', { name: 'Island' }).click();
await settle();

await page.getByRole('button', { name: 'Open settings' }).click();
await page.getByRole('button', { name: 'Sunday' }).click();
await page.getByRole('button', { name: 'Close' }).click();
await tabs.getByRole('button', { name: 'Stats' }).click();
await settle();
const weekHead = page.getByRole('button', { name: /day \d+ \w+: / }).nth(daysInMonth);
check('Week starts on Sunday reorders the week', (await weekHead.getAttribute('aria-label')).startsWith('Sunday'));
await tabs.getByRole('button', { name: 'Island' }).click();
await settle();
await page.getByRole('button', { name: 'Open settings' }).click();
await page.getByRole('button', { name: 'Increase Focus length' }).click();
await page.getByRole('button', { name: 'Decrease Break length' }).click();
await page.getByRole('button', { name: 'Close' }).click();
await page.reload();
await settle(1500);
check('settings persist across a reload', (await page.locator('p', { hasText: /30 min focus/i }).count()) > 0);

// Expiry (Phase 2): a week later the animal leaves gold; it shows on Home and stays after a reload.
const earnedUnicorn = (await page.getByRole('img', { name: '1 Unicorn on the island' }).count()) === 1;
await page.clock.fastForward(7 * 24 * 3600_000 + 61_000); // one 60 s check fires after the jump
await settle(2500); // the count-up runs after the notice shows
const departure = page.getByRole('status').getByText(/^.+ left \d+ gold\.$/);
if (earnedUnicorn) {
  // A rare roll: Unicorns never leave, so there is nothing to show.
  check('a Unicorn never leaves (rare roll)', (await departure.count()) === 0 && (await goldShown()) === 30);
} else {
  check('a week later the animal leaves gold, shown on Home', await departure.isVisible());
  const earned = Number((await departure.innerText()).match(/(\d+) gold/)[1]);
  check('the gold counter counts up to include it', earned > 0 && (await goldShown()) === 30 + earned);
  await page.getByRole('button', { name: 'OK' }).click();
  await page.getByRole('button', { name: 'Open collection' }).click();
  await settle();
  check('the collection still counts it, with none on the island', (await page.getByText(collected).isVisible()) && (await page.getByText('On island: 0').count()) === 1);
  await page.getByRole('button', { name: 'Close' }).click();
  await page.reload();
  await settle(1500);
  check('gold and the departure survive a reload', (await goldShown()) === 30 + earned && (await page.getByRole('status').count()) === 0);
}

// Shop (Phase 3): buy a fence; gold drops by its price and the purchase survives a reload.
const goldBefore = await goldShown();
await goldButton.click();
await settle(500);
await page.getByRole('button', { name: 'Buy Fence' }).click();
await settle(500);
const sheet3 = page.getByRole('dialog');
check('the confirm sheet shows price and balance', await sheet3.getByText(`10 gold · you have ${goldBefore}`).isVisible());
await sheet3.getByRole('button', { name: 'Buy', exact: true }).click();
await settle(500);
check('buying says it is yours and points to build mode', (await sheet3.getByText("It's yours.").isVisible()) && (await sheet3.getByText('Place it in build mode.').isVisible()));
await sheet3.getByRole('button', { name: 'Done' }).click();
await settle(300);
check('the card shows the owned fence', (await page.getByText('Owned ×1').count()) >= 1);
await page.getByRole('button', { name: 'Close' }).click();
await settle(500);
check('the gold counter drops by the price', (await goldShown()) === goldBefore - 10);
await page.reload();
await settle(1500);
check('the purchase survives a reload', (await goldShown()) === goldBefore - 10);

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

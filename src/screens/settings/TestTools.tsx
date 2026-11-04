import { useState } from 'react';
import { SERVER_KEY, type FakeRemote } from '../../platform/remote/fake';
import { appStore } from '../../store';
import { strings } from '../../ui/strings';
import { Button } from '../../ui/components/Button';
import { SettingsRow } from '../../ui/components/Controls';
import styles from '../Screen.module.css';
import local from './SettingsScreen.module.css';

const t = strings.testTools;
type Action = keyof typeof t.done | 'check';

/** What the test server and this device hold for the signed-in user. */
async function check(fake: FakeRemote, userId: string): Promise<string> {
  const { testTools } = await import('../../platform/remote/fakeBots');
  const s = await testTools.status(fake, userId);
  const state = appStore.getState();
  const raw = globalThis.localStorage?.getItem(SERVER_KEY) ?? '';
  return t.status({
    ...s,
    user: userId,
    device: state.account.userId ?? '—',
    local: state.animals.filter((a) => a.status === 'active').length,
    sizeKb: Math.round(raw.length / 1024),
    saveError: (globalThis as { __siftFakeSaveError?: string }).__siftFakeSaveError ?? null,
  });
}

/** Runs one test tool against the fake server, then pulls the result into the app. */
async function run(action: Action): Promise<string> {
  const fake = (globalThis as { __siftFake?: FakeRemote }).__siftFake;
  const userId = (await fake?.auth.session())?.userId;
  if (!fake || !userId) return t.problems.no_island;
  if (action === 'check') return check(fake, userId);
  const { testTools } = await import('../../platform/remote/fakeBots');
  const result =
    action === 'army' ? await testTools.grantArmy(fake, userId) : action === 'timers' ? (await testTools.resetWarTimers(fake, userId), 'ok') : await testTools.botAttack(fake, userId);
  const s = appStore.getState();
  await s.sync(true);
  await Promise.all([s.refreshGroup(), s.loadWars()]);
  if (typeof result === 'object') return t.armyAdded(result.added, (await testTools.status(fake, userId)).canFight);
  if (result === 'ok') return t.done[action as keyof typeof t.done];
  return result in t.problems ? (t.problems[result as keyof typeof t.problems] as string) : t.problems.failed(result);
}

/** Settings › Test tools (dev builds with `backend.provider: fake`): a test army, war timers, a bot attack, a check. */
export function TestTools() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (action: Action) => {
    setBusy(true);
    setMessage(await run(action).catch((e: unknown) => t.problems.failed(String(e))));
    setBusy(false);
  };
  const row = (label: string, button: string, action: Action) => (
    <SettingsRow label={label}>
      <Button variant="secondary" disabled={busy} onClick={() => void act(action)}>
        {button}
      </Button>
    </SettingsRow>
  );
  return (
    <>
      <h2 className={`${styles.eyebrow} type-eyebrow`}>{t.section}</h2>
      <p className={`${local.warning} type-body-sm`}>{t.note}</p>
      {row(t.army, t.armyButton, 'army')}
      {row(t.timers, t.timersButton, 'timers')}
      {row(t.attack, t.attackButton, 'attack')}
      {row(t.check, t.checkButton, 'check')}
      {message && (
        <p className="type-body-sm" role="status">
          {message}
        </p>
      )}
    </>
  );
}

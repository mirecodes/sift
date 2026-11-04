import { useState } from 'react';
import type { FakeRemote } from '../../platform/remote/fake';
import { appStore } from '../../store';
import { strings } from '../../ui/strings';
import { Button } from '../../ui/components/Button';
import { SettingsRow } from '../../ui/components/Controls';
import styles from '../Screen.module.css';
import local from './SettingsScreen.module.css';

const t = strings.testTools;
type Action = keyof typeof t.done;

/** Runs one test tool against the fake server, then pulls the result into the app. */
async function run(action: Action): Promise<string> {
  const fake = (globalThis as { __siftFake?: FakeRemote }).__siftFake;
  const userId = (await fake?.auth.session())?.userId;
  if (!fake || !userId) return t.problems.no_island;
  const { testTools } = await import('../../platform/remote/fakeBots');
  const result =
    action === 'army' ? await testTools.grantArmy(fake, userId) : action === 'timers' ? (await testTools.resetWarTimers(fake, userId), 'ok') : await testTools.botAttack(fake, userId);
  const s = appStore.getState();
  await s.sync(true);
  await Promise.all([s.refreshGroup(), s.loadWars()]);
  if (result === 'ok') return t.done[action];
  return result in t.problems ? (t.problems[result as keyof typeof t.problems] as string) : t.problems.failed(result);
}

/** Settings › Test tools (dev builds with `backend.provider: fake`): a test army, war timers, a bot attack. */
export function TestTools() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (action: Action) => {
    setBusy(true);
    setMessage(await run(action).catch((e: unknown) => t.problems.failed(String(e))));
    setBusy(false);
  };
  return (
    <>
      <h2 className={`${styles.eyebrow} type-eyebrow`}>{t.section}</h2>
      <p className={`${local.warning} type-body-sm`}>{t.note}</p>
      <SettingsRow label={t.army}>
        <Button variant="secondary" disabled={busy} onClick={() => void act('army')}>
          {t.armyButton}
        </Button>
      </SettingsRow>
      <SettingsRow label={t.timers}>
        <Button variant="secondary" disabled={busy} onClick={() => void act('timers')}>
          {t.timersButton}
        </Button>
      </SettingsRow>
      <SettingsRow label={t.attack}>
        <Button variant="secondary" disabled={busy} onClick={() => void act('attack')}>
          {t.attackButton}
        </Button>
      </SettingsRow>
      {message && (
        <p className="type-body-sm" role="status">
          {message}
        </p>
      )}
    </>
  );
}

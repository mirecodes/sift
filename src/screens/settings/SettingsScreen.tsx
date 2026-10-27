import { useState } from 'react';
import { config } from '../../domain/config';
import { PUSH_CATEGORIES } from '../../../shared/rules/push';
import { backupFileName, parseBackup, summarizeBackup, type Backup, type BackupError } from '../../domain/backup';
import { platform } from '../../platform';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { Button, IconButton } from '../../ui/components/Button';
import { runtimeConfig } from '../../app/runtimeConfig';
import { Segmented, SettingsRow, Stepper, Toggle } from '../../ui/components/Controls';
import { CloseIcon } from '../../ui/components/Icons';
import { FeatureCard } from '../../ui/components/Surfaces';
import { TopBar } from '../../ui/components/TopBar';
import { AccountSection } from '../account/AccountSection';
import styles from '../Screen.module.css';
import local from './SettingsScreen.module.css';

/** Export a backup, or import one after a summary and confirmation. */
function DataSection() {
  const exportBackup = useApp((s) => s.exportBackup);
  const importBackup = useApp((s) => s.importBackup);
  const [pending, setPending] = useState<Backup | null>(null);
  const [error, setError] = useState<BackupError | null>(null);

  const doExport = async () => {
    const backup = await exportBackup();
    await platform.files.save(backupFileName(backup), JSON.stringify(backup), 'application/json');
  };
  const pick = async () => {
    const text = await platform.files.open('application/json,.json');
    if (text === null) return;
    const parsed = parseBackup(text, platform.storage.schemaVersion);
    setPending(parsed.ok ? parsed.backup : null);
    setError(parsed.ok ? null : parsed.error);
  };
  const replace = async () => {
    if (!pending) return;
    try {
      await importBackup(pending);
      setPending(null);
    } catch (e) {
      console.warn('Sift: import failed, local data unchanged.', e);
      setPending(null);
      setError('invalid');
    }
  };
  const summary = pending && summarizeBackup(pending);

  return (
    <>
      <SettingsRow label={strings.settings.exportData}>
        <Button variant="secondary" onClick={() => void doExport()}>
          {strings.settings.exportButton}
        </Button>
      </SettingsRow>
      <SettingsRow label={strings.settings.importData}>
        <Button variant="secondary" onClick={() => void pick()}>
          {strings.settings.importButton}
        </Button>
      </SettingsRow>
      {summary && (
        <FeatureCard className={local.confirm}>
          <p className="type-body-md">{strings.settings.backupSummary(summary.exportedAt, summary.sessions, summary.animals)}</p>
          <p className={`${local.warning} type-body-sm`}>{strings.settings.replaceWarning}</p>
          <div className={local.actions}>
            <Button onClick={() => void replace()}>{strings.settings.replace}</Button>
            <Button variant="secondary" onClick={() => setPending(null)}>
              {strings.settings.cancel}
            </Button>
          </div>
        </FeatureCard>
      )}
      {error && (
        <p className={`${local.error} type-body-sm`} role="alert">
          {error === 'newer' ? strings.settings.backupNewer : strings.settings.backupInvalid}
        </p>
      )}
    </>
  );
}

export function SettingsScreen() {
  const settings = useApp((s) => s.settings);
  const updateSettings = useApp((s) => s.updateSettings);
  const setView = useApp((s) => s.setView);
  const setPushCategory = useApp((s) => s.setPushCategory);
  const account = useApp((s) => s.account.status);
  const { focusMinutes, breakMinutes } = config.settings;

  return (
    <div className={styles.page}>
      <TopBar>
        <IconButton aria-label={strings.aria.close} onClick={() => setView('home')}>
          <CloseIcon />
        </IconButton>
      </TopBar>
      <main className={styles.content}>
        <h1 className={`${styles.title} type-display-md`}>{strings.settings.title}</h1>

        <h2 className={`${styles.eyebrow} type-eyebrow`}>{strings.settings.timer}</h2>
        <SettingsRow label={strings.settings.focusLength}>
          <Stepper
            label={strings.settings.focusLength}
            value={settings.focusMinutes}
            min={focusMinutes.min}
            max={focusMinutes.max}
            step={focusMinutes.step}
            unit={strings.settings.minutes}
            onChange={(v) => void updateSettings({ focusMinutes: v })}
          />
        </SettingsRow>
        <SettingsRow label={strings.settings.breakLength}>
          <Stepper
            label={strings.settings.breakLength}
            value={settings.breakMinutes}
            min={breakMinutes.min}
            max={breakMinutes.max}
            step={breakMinutes.step}
            unit={strings.settings.minutes}
            onChange={(v) => void updateSettings({ breakMinutes: v })}
          />
        </SettingsRow>

        {platform.name !== 'web' && runtimeConfig.features.liveProgress && (
          <SettingsRow label={strings.settings.liveProgress}>
            <Toggle label={strings.settings.liveProgress} checked={settings.liveProgress} onChange={(v) => void updateSettings({ liveProgress: v })} />
          </SettingsRow>
        )}

        <h2 className={`${styles.eyebrow} type-eyebrow`}>{strings.settings.sound}</h2>
        <SettingsRow label={strings.settings.chimes}>
          <Toggle label={strings.settings.chimes} checked={settings.soundEnabled} onChange={(v) => void updateSettings({ soundEnabled: v })} />
        </SettingsRow>

        {platform.push.available && account === 'signedIn' && (
          <>
            <h2 className={`${styles.eyebrow} type-eyebrow`}>{strings.settings.notifications}</h2>
            {PUSH_CATEGORIES.map((c) => (
              <SettingsRow key={c} label={strings.push.categories[c]}>
                <Toggle label={strings.push.categories[c]} checked={settings.pushCategories[c]} onChange={(v) => void setPushCategory(c, v)} />
              </SettingsRow>
            ))}
          </>
        )}

        {runtimeConfig.features.stats && (
          <>
            <h2 className={`${styles.eyebrow} type-eyebrow`}>{strings.settings.stats}</h2>
            <SettingsRow label={strings.settings.weekStartsOn}>
              <Segmented
                label={strings.settings.weekStartsOn}
                options={[
                  { value: 1, label: strings.settings.monday },
                  { value: 0, label: strings.settings.sunday },
                ]}
                value={settings.weekStartsOn}
                onChange={(v) => void updateSettings({ weekStartsOn: v })}
              />
            </SettingsRow>
          </>
        )}

        {account !== 'off' && (
          <>
            <h2 className={`${styles.eyebrow} type-eyebrow`}>{strings.account.section}</h2>
            <AccountSection />
          </>
        )}

        <h2 className={`${styles.eyebrow} type-eyebrow`}>{strings.settings.data}</h2>
        <DataSection />
      </main>
    </div>
  );
}

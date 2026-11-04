import { useRef, useState } from 'react';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { Button } from '../../ui/components/Button';
import { TextField } from '../../ui/components/Controls';
import { Sheet, sheetStyles, type SheetHandle } from '../../ui/components/Sheet';
import { downloadBackup } from './backupDownload';
import styles from './Account.module.css';

/**
 * First sign-in when the account already has an island (Step 5.7): keep the account's data (a copy of this
 * device is downloaded first) or replace the account with this device (typed confirmation).
 */
export function AccountChoiceSheet() {
  const sheet = useRef<SheetHandle>(null);
  const resolve = useApp((s) => s.resolveAccountChoice);
  const cancel = useApp((s) => s.cancelAccountChoice);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const decided = useRef(false);

  const choose = async (choice: 'useAccount' | 'replaceAccount') => {
    setBusy(true);
    setFailed(false);
    try {
      if (choice === 'useAccount') await downloadBackup();
      await resolve(choice);
      decided.current = true;
      sheet.current?.close();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <Sheet ref={sheet} title={strings.account.choiceTitle} onClose={() => !decided.current && void cancel()} wide>
      <p className="type-body-md">{strings.account.choiceBody}</p>
      <div className={styles.choices}>
        <div>
          <Button block disabled={busy} onClick={() => void choose('useAccount')}>
            {strings.account.useAccount}
          </Button>
          <p className={`${sheetStyles.note} type-body-sm`}>{strings.account.useAccountNote}</p>
        </div>
        <div>
          <TextField label={strings.account.typeToConfirm(strings.account.replaceWord)} value={typed} onChange={setTyped} autoComplete="off" />
          <p className={`${sheetStyles.note} type-body-sm`}>{strings.account.replaceNote}</p>
          <div className={sheetStyles.actions}>
            <Button variant="secondary" disabled={busy || typed.trim() !== strings.account.replaceWord} onClick={() => void choose('replaceAccount')}>
              {strings.account.replaceAccount}
            </Button>
          </div>
        </div>
      </div>
      {failed && <p className={`${sheetStyles.error} type-body-sm`}>{strings.account.noConnection}</p>}
    </Sheet>
  );
}

/** Blocking screen when the server refuses this app version (`client_outdated`, Step 5.2). */
export function OutdatedScreen() {
  return (
    <div className={styles.outdated} role="alertdialog" aria-labelledby="outdated-title">
      <div>
        <h1 id="outdated-title" className="type-display-sm">
          {strings.account.outdatedTitle}
        </h1>
        <p className="type-body-md">{strings.account.outdatedBody}</p>
        <Button onClick={() => location.reload()}>{strings.account.reload}</Button>
      </div>
    </div>
  );
}

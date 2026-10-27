import { useRef, useState } from 'react';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { Button } from '../../ui/components/Button';
import { SettingsRow, TextField } from '../../ui/components/Controls';
import { Sheet, sheetStyles, type SheetHandle } from '../../ui/components/Sheet';
import { downloadBackup } from './backupDownload';
import { SignInSheet } from './SignInSheet';
import styles from './Account.module.css';

function ConfirmSheet({ kind, onClose }: { kind: 'signOut' | 'delete'; onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const signOut = useApp((s) => s.signOut);
  const deleteAccount = useApp((s) => s.deleteAccount);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const del = kind === 'delete';
  const go = async () => {
    setBusy(true);
    try {
      await (del ? deleteAccount() : signOut());
      sheet.current?.close();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <Sheet ref={sheet} title={del ? strings.account.deleteTitle : strings.account.signOutTitle} onClose={onClose}>
      <p className="type-body-md">{del ? strings.account.deleteBody : strings.account.signOutBody}</p>
      {del && <TextField label={strings.account.typeToConfirm(strings.account.deleteWord)} value={typed} onChange={setTyped} autoComplete="off" />}
      {failed && <p className={`${sheetStyles.error} type-body-sm`}>{strings.account.noConnection}</p>}
      <div className={sheetStyles.actions}>
        <Button variant="secondary" onClick={() => void downloadBackup()}>
          {strings.account.exportFirst}
        </Button>
        <Button variant="secondary" onClick={() => sheet.current?.close()}>
          {strings.account.cancel}
        </Button>
        <Button onClick={() => void go()} disabled={busy || (del && typed.trim() !== strings.account.deleteWord)}>
          {del ? strings.account.confirmDelete : strings.account.signOut}
        </Button>
      </div>
    </Sheet>
  );
}

function PrivacySheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title={strings.account.privacyTitle} onClose={onClose}>
      <ul className={`${styles.privacy} type-body-md`}>
        {strings.account.privacyBody.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Settings → Account (Step 5.4, DESIGN.md 7.4): sign in, who is signed in, sign out, delete, privacy. */
export function AccountSection() {
  const account = useApp((s) => s.account);
  const [open, setOpen] = useState<null | 'signIn' | 'signOut' | 'delete' | 'privacy'>(null);
  if (account.status === 'off') return null;
  const signedIn = account.status === 'signedIn' || account.status === 'expired';

  return (
    <>
      {signedIn ? (
        <>
          <SettingsRow label={strings.account.signedInAs(account.email ?? strings.account.anonymous)}>
            <Button variant="secondary" onClick={() => setOpen('signOut')}>
              {strings.account.signOut}
            </Button>
          </SettingsRow>
          {account.status === 'expired' && (
            <SettingsRow label={strings.account.expired}>
              <Button onClick={() => setOpen('signIn')}>{strings.account.signInAgain}</Button>
            </SettingsRow>
          )}
          {!account.online && <p className={`${styles.status} type-body-sm`}>{strings.account.offline}</p>}
          <SettingsRow label={strings.account.deleteAccount}>
            <Button variant="secondary" onClick={() => setOpen('delete')}>
              {strings.account.deleteAccount}
            </Button>
          </SettingsRow>
        </>
      ) : (
        <SettingsRow label={strings.account.pitch}>
          <Button onClick={() => setOpen('signIn')}>{strings.account.signIn}</Button>
        </SettingsRow>
      )}
      <button type="button" className={`${styles.link} type-body-sm`} onClick={() => setOpen('privacy')}>
        {strings.account.privacy}
      </button>
      {open === 'signIn' && <SignInSheet onClose={() => setOpen(null)} />}
      {(open === 'signOut' || open === 'delete') && <ConfirmSheet kind={open === 'delete' ? 'delete' : 'signOut'} onClose={() => setOpen(null)} />}
      {open === 'privacy' && <PrivacySheet onClose={() => setOpen(null)} />}
    </>
  );
}

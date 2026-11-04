import { useRef, useState } from 'react';
import { runtimeConfig } from '../../app/runtimeConfig';
import { RemoteError } from '../../platform/remote';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { Button } from '../../ui/components/Button';
import { TextField } from '../../ui/components/Controls';
import { Sheet, sheetStyles, type SheetHandle } from '../../ui/components/Sheet';
import styles from './Account.module.css';

const message = (e: unknown) =>
  e instanceof RemoteError ? (e.code === 'network' || e.code === 'offline' ? strings.account.noConnection : e.code === 'unauthorized' ? strings.account.wrongCode : strings.account.failed) : strings.account.failed;

/**
 * Sign in (Step 5.4, DESIGN.md 7.10): email → 6-digit code, or Apple / Google. A code works when the email
 * is read on another device and needs no redirect back into the app.
 */
export function SignInSheet({ onClose }: { onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const requestCode = useApp((s) => s.requestSignInCode);
  const verify = useApp((s) => s.verifySignInCode);
  const withProvider = useApp((s) => s.signInWithProvider);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>, close = false) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (close) sheet.current?.close();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <Sheet ref={sheet} title={strings.account.signInTitle} onClose={onClose}>
      <p className={`${sheetStyles.note} type-body-sm`}>{strings.account.pitch}</p>
      {!sent ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (validEmail) void run(async () => (await requestCode(email.trim()), setSent(true)));
          }}
        >
          <TextField label={strings.account.email} type="email" inputMode="email" autoComplete="email" placeholder={strings.account.emailPlaceholder} value={email} onChange={setEmail} />
          <div className={sheetStyles.actions}>
            <Button type="submit" disabled={!validEmail || busy}>
              {strings.account.sendCode}
            </Button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => verify(email.trim(), code.trim()), true);
          }}
        >
          <p className="type-body-md">{strings.account.codeSent(email.trim())}</p>
          <TextField label={strings.account.code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(v) => setCode(v.replace(/\D/g, ''))} />
          <div className={sheetStyles.actions}>
            <Button variant="secondary" onClick={() => (setSent(false), setCode(''))}>
              {strings.account.otherEmail}
            </Button>
            <Button type="submit" disabled={code.length !== 6 || busy}>
              {strings.account.verify}
            </Button>
          </div>
        </form>
      )}
      {runtimeConfig.backend.provider === 'fake' && <p className={`${sheetStyles.note} type-body-sm`}>{strings.account.fakeHint}</p>}
      {error && (
        <p className={`${sheetStyles.error} type-body-sm`} role="alert">
          {error}
        </p>
      )}
      <p className={`${styles.or} type-body-sm`}>{strings.account.or}</p>
      <div className={styles.providers}>
        <Button variant="secondary" block disabled={busy} onClick={() => void run(() => withProvider('apple'), true)}>
          {strings.account.apple}
        </Button>
        <Button variant="secondary" block disabled={busy} onClick={() => void run(() => withProvider('google'), true)}>
          {strings.account.google}
        </Button>
      </div>
    </Sheet>
  );
}

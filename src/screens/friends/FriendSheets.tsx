import { useRef, useState } from 'react';
import type { PersonView, ReportReason } from '../../../shared/api/types';
import { formatHandle } from '../../../shared/rules/handle';
import { useApp } from '../../store';
import type { Outcome } from '../../store/social';
import { strings } from '../../ui/strings';
import { Button } from '../../ui/components/Button';
import { Segmented, TextField } from '../../ui/components/Controls';
import { Sheet, sheetStyles, type SheetHandle } from '../../ui/components/Sheet';
import { Avatar, HandleText } from './Person';
import styles from './Friends.module.css';

export const errorText = (code: Outcome): string => (code ? (strings.friends.errors[code] ?? strings.friends.errors.generic!) : '');

const name = (p: PersonView) => (p.handle ? formatHandle(p.handle) : '…');

/** Add a friend by exact `name#tag` (Step 7.3). */
export function AddFriendSheet({ initial = '', onClose }: { initial?: string; onClose: () => void }) {
  const addFriend = useApp((s) => s.addFriend);
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const send = async () => {
    setBusy(true);
    const res = await addFriend(text);
    setBusy(false);
    if (res.outcome) setNote({ ok: false, text: errorText(res.outcome) });
    else {
      setNote({ ok: true, text: res.status === 'accepted' ? strings.friends.nowFriends : strings.friends.requestSent });
      setText('');
    }
  };
  return (
    <Sheet title={strings.friends.addFriend} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <TextField label={strings.friends.handleField} value={text} onChange={setText} placeholder={strings.friends.handlePlaceholder} autoComplete="off" maxLength={40} />
        {note && <p className={`${note.ok ? sheetStyles.note : sheetStyles.error} type-body-sm`} role="status">{note.text}</p>}
        <div className={sheetStyles.actions}>
          <Button type="submit" disabled={busy || !text.includes('#')}>
            {strings.friends.sendRequest}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** Remove or Block, confirmed in one line (DESIGN.md 7.11). */
export function ConfirmSheet({ kind, person, onClose }: { kind: 'remove' | 'block'; person: PersonView; onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const removeFriend = useApp((s) => s.removeFriend);
  const blockUser = useApp((s) => s.blockUser);
  const [error, setError] = useState<Outcome>(null);
  const go = async () => {
    const outcome = await (kind === 'remove' ? removeFriend(person.userId) : blockUser(person.userId));
    if (outcome) setError(outcome);
    else sheet.current?.close();
  };
  const remove = kind === 'remove';
  return (
    <Sheet ref={sheet} title={remove ? strings.friends.removeTitle(name(person)) : strings.friends.blockTitle(name(person))} onClose={onClose}>
      <p className="type-body-md">{remove ? strings.friends.removeBody : strings.friends.blockBody}</p>
      {error && <p className={`${sheetStyles.error} type-body-sm`}>{errorText(error)}</p>}
      <div className={sheetStyles.actions}>
        <Button variant="secondary" onClick={() => sheet.current?.close()}>
          {strings.friends.cancel}
        </Button>
        <Button onClick={() => void go()}>{remove ? strings.friends.remove : strings.friends.block}</Button>
      </div>
    </Sheet>
  );
}

/** Report a user (Step 7.2): reason, optional note. */
export function ReportSheet({ person, context, onClose }: { person: PersonView; context: 'friends' | 'group' | 'visit'; onClose: () => void }) {
  const reportUser = useApp((s) => s.reportUser);
  const [reason, setReason] = useState<ReportReason>('name');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'edit' | 'sent' | Outcome>('edit');
  const send = async () => {
    const outcome = await reportUser(person.userId, reason, note, context);
    setState(outcome ?? 'sent');
  };
  return (
    <Sheet title={strings.friends.reportTitle(name(person))} onClose={onClose}>
      {state === 'sent' ? (
        <p className="type-body-md" role="status">
          {strings.friends.reported}
        </p>
      ) : (
        <>
          <Segmented
            label={strings.friends.reason}
            options={(Object.keys(strings.friends.reasons) as ReportReason[]).map((r) => ({ value: r, label: strings.friends.reasons[r] }))}
            value={reason}
            onChange={setReason}
          />
          <TextField label={strings.friends.note} value={note} onChange={setNote} maxLength={500} />
          {state !== 'edit' && <p className={`${sheetStyles.error} type-body-sm`}>{errorText(state)}</p>}
          <div className={sheetStyles.actions}>
            <Button onClick={() => void send()}>{strings.friends.sendReport}</Button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** The `⋯` menu of a person: Remove (friends only), Block, Report. */
export function PersonMenu({ person, context, friend, onClose }: { person: PersonView; context: 'friends' | 'group' | 'visit'; friend: boolean; onClose: () => void }) {
  const [next, setNext] = useState<'remove' | 'block' | 'report' | null>(null);
  if (next === 'report') return <ReportSheet person={person} context={context} onClose={onClose} />;
  if (next) return <ConfirmSheet kind={next} person={person} onClose={onClose} />;
  return (
    <Sheet title={<HandleText handle={person.handle} />} onClose={() => next === null && onClose()}>
      <div className={styles.me}>
        <Avatar speciesId={person.avatarSpeciesId} />
      </div>
      <div className={sheetStyles.actions}>
        {friend && (
          <Button variant="secondary" onClick={() => setNext('remove')}>
            {strings.friends.remove}
          </Button>
        )}
        <Button variant="secondary" onClick={() => setNext('block')}>
          {strings.friends.block}
        </Button>
        <Button variant="secondary" onClick={() => setNext('report')}>
          {strings.friends.report}
        </Button>
      </div>
    </Sheet>
  );
}

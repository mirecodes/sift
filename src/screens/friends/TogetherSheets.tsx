import { useEffect, useRef, useState } from 'react';
import { formatHandle } from '../../../shared/rules/handle';
import { useApp } from '../../store';
import type { Outcome } from '../../store/social';
import { strings } from '../../ui/strings';
import { Button } from '../../ui/components/Button';
import { Sheet, sheetStyles, type SheetHandle } from '../../ui/components/Sheet';
import { errorText } from './FriendSheets';
import { Avatar, HandleText } from './Person';
import styles from './Friends.module.css';

/** Lobby polling while it is open (Step 7.7). */
const LOBBY_POLL_MS = 3_000;

/** Pick friends to focus with; the tapped one starts checked (DESIGN.md 7.13). */
export function TogetherInviteSheet({ preselect, onClose }: { preselect: string[]; onClose: () => void }) {
  const friends = useApp((s) => s.social?.friends) ?? [];
  const minutes = useApp((s) => s.settings.focusMinutes);
  const createRoom = useApp((s) => s.createRoom);
  const [picked, setPicked] = useState(() => new Set(preselect));
  const [error, setError] = useState<Outcome>(null);
  const sheet = useRef<SheetHandle>(null);
  const invite = async () => {
    const outcome = await createRoom([...picked]);
    if (outcome) setError(outcome);
    else sheet.current?.close();
  };
  return (
    <Sheet ref={sheet} title={strings.friends.togetherTitle} onClose={onClose}>
      <p className={`${sheetStyles.note} type-body-sm`}>{strings.friends.togetherHint(minutes)}</p>
      <ul className={styles.picks}>
        {friends.map((f) => (
          <li key={f.userId}>
            <label className={styles.pick}>
              <input
                type="checkbox"
                checked={picked.has(f.userId)}
                onChange={(e) => {
                  const next = new Set(picked);
                  if (e.target.checked) next.add(f.userId);
                  else next.delete(f.userId);
                  setPicked(next);
                }}
              />
              <Avatar speciesId={f.avatarSpeciesId} size={32} />
              <HandleText handle={f.handle} />
            </label>
          </li>
        ))}
      </ul>
      {error && <p className={`${sheetStyles.error} type-body-sm`}>{errorText(error)}</p>}
      <div className={sheetStyles.actions}>
        <Button disabled={picked.size === 0} onClick={() => void invite()}>
          {strings.friends.invite}
        </Button>
      </div>
    </Sheet>
  );
}

/**
 * The lobby (Step 7.7): who joined, Start for the host. Polls the room; when the host starts, every
 * device that joined starts its focus at the shared server time (`pollRoom`) and the lobby closes.
 */
export function LobbySheet() {
  const room = useApp((s) => s.room);
  const me = useApp((s) => s.account.userId);
  const pollRoom = useApp((s) => s.pollRoom);
  const startRoom = useApp((s) => s.startRoom);
  const leaveRoom = useApp((s) => s.leaveRoom);
  const [error, setError] = useState<Outcome>(null);
  useEffect(() => {
    const id = setInterval(() => void pollRoom(), LOBBY_POLL_MS);
    return () => clearInterval(id);
  }, [pollRoom]);
  if (!room) return null;
  const host = room.participants.find((p) => p.person.userId === room.hostId);
  const isHost = room.hostId === me;
  const someoneJoined = room.participants.some((p) => p.person.userId !== room.hostId && p.state === 'joined');
  const closed = room.status === 'closed';
  return (
    <Sheet title={strings.friends.togetherTitle} onClose={() => void leaveRoom()}>
      <p className={`${sheetStyles.note} type-body-sm`}>
        {closed ? strings.friends.errors.room_closed : strings.friends.lobbyHint(Math.round(room.plannedMs / 60_000), host?.person.handle ? formatHandle(host.person.handle) : '…')}
      </p>
      <ul className={styles.list}>
        {room.participants.map((p) => (
          <li key={p.person.userId} className={styles.row}>
            <Avatar speciesId={p.person.avatarSpeciesId} size={32} />
            <span className={styles.who}>
              <HandleText handle={p.person.handle} />
              <span className={`${styles.muted} type-caption`}>{strings.friends.states[p.state]}</span>
            </span>
          </li>
        ))}
      </ul>
      {error && <p className={`${sheetStyles.error} type-body-sm`}>{errorText(error)}</p>}
      <div className={sheetStyles.actions}>
        <Button variant="secondary" onClick={() => void leaveRoom()}>
          {isHost && !closed ? strings.friends.cancel : strings.friends.leave}
        </Button>
        {isHost && !closed && (
          <Button
            disabled={!someoneJoined}
            onClick={async () => {
              const outcome = await startRoom();
              if (outcome) setError(outcome);
            }}
          >
            {strings.friends.start}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

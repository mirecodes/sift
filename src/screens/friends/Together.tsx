import { useEffect, useState } from 'react';
import { balance } from '../../../shared/balance/balance';
import { runtimeConfig } from '../../app/runtimeConfig';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { ItemSprite } from '../collection/ItemSprite';
import { Avatar } from './Person';
import { TogetherInviteSheet } from './TogetherSheets';
import styles from './Friends.module.css';

/** Room refresh during Focus and Break: slow and silent (§2.14). */
const QUIET_POLL_MS = 30_000;

/**
 * During Focus, the one social line allowed (Step 7.7, §2.14 exception): `with 민지 · 재현` and a static
 * dot per other participant (filled while they focus). Updates silently; hidden when presence is off.
 */
export function TogetherLine() {
  const room = useApp((s) => s.room);
  const me = useApp((s) => s.account.userId);
  const show = useApp((s) => s.settings.showFocusPresence);
  const pollRoom = useApp((s) => s.pollRoom);
  const roomId = room?.id;
  useEffect(() => {
    if (!roomId) return;
    const id = setInterval(() => void pollRoom(), QUIET_POLL_MS);
    return () => clearInterval(id);
  }, [roomId, pollRoom]);
  if (!room || !show || room.status !== 'started') return null;
  const others = room.participants.filter((p) => p.person.userId !== me && (p.state === 'focusing' || p.state === 'done' || p.state === 'stopped'));
  if (!others.length) return null;
  return (
    <div className={`${styles.withLine} type-body-sm`}>
      <span>{strings.friends.withLine(others.map((p) => p.person.handle?.name ?? '…'))}</span>
      <span className={styles.dots} aria-hidden="true">
        {others.map((p) => (
          <span key={p.person.userId} data-on={p.state === 'focusing'} />
        ))}
      </span>
    </div>
  );
}

/** On Break: each participant's result and revealed animal (Step 7.7). */
export function TogetherStrip() {
  const room = useApp((s) => s.room);
  const pollRoom = useApp((s) => s.pollRoom);
  const roomId = room?.id;
  useEffect(() => {
    if (!roomId) return;
    void pollRoom();
    const id = setInterval(() => void pollRoom(), QUIET_POLL_MS);
    return () => clearInterval(id);
  }, [roomId, pollRoom]);
  if (!room || room.status !== 'started') return null;
  const shown = room.participants.filter((p) => p.state !== 'invited' && p.state !== 'left');
  return (
    <div className={styles.strip}>
      <p className="type-eyebrow">{strings.friends.togetherStrip}</p>
      <div className={styles.stripRow}>
        {shown.map((p) => (
          <span key={p.person.userId} className={styles.stripItem}>
            {p.animal ? <ItemSprite id={p.animal.skinId ?? p.animal.speciesId} size={48} /> : <span className={styles.hollow} aria-hidden="true" />}
            <span className="type-caption">{p.person.handle?.name ?? '…'}</span>
            <span className={`${styles.muted} type-caption`}>{strings.friends.states[p.state]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Home presence (Step 7.6): up to three friends' faces and `3 friends focusing`; a tap invites them to
 * focus together. Polled while Home is shown; hidden when nobody focuses.
 */
export function FriendsFocusing() {
  const signedIn = useApp((s) => s.account.status === 'signedIn');
  const friends = useApp((s) => s.social?.friends);
  const refresh = useApp((s) => s.refreshSocial);
  const [inviting, setInviting] = useState<string[] | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    void refresh();
    const id = setInterval(() => void refresh(), balance.social.presencePollMs);
    return () => clearInterval(id);
  }, [signedIn, refresh]);
  const focusing = (friends ?? []).filter((f) => f.focusing);
  if (!signedIn || focusing.length === 0) return null;
  const canInvite = runtimeConfig.features.together;
  return (
    <>
      <button type="button" className={`${styles.stack} type-caption`} disabled={!canInvite} onClick={() => setInviting(focusing.map((f) => f.userId))}>
        <span className={styles.faces}>
          {focusing.slice(0, 3).map((f) => (
            <Avatar key={f.userId} speciesId={f.avatarSpeciesId} size={24} />
          ))}
        </span>
        {strings.friends.friendsFocusing(focusing.length)}
      </button>
      {inviting && <TogetherInviteSheet preselect={inviting} onClose={() => setInviting(null)} />}
    </>
  );
}

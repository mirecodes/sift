import { formatHandle } from '../../shared/rules/handle';
import type { SocialState } from '../../shared/api/types';
import { getSpecies } from '../domain/animals/catalog';
import type { Notice } from '../domain/inbox/inbox';
import type { PlacedAnimal } from '../domain/types';
import { selectCurrentNotice, useApp } from '../store';
import { strings } from '../ui/strings';
import { Button } from '../ui/components/Button';
import { Panel } from '../ui/components/Surfaces';
import styles from './NoticeCard.module.css';

/** A user's handle when the Friends data knows them (notices carry ids only). */
function handleOf(social: SocialState | null, userId: string): string | undefined {
  const all = social ? [...social.friends, ...social.incoming, ...social.outgoing] : [];
  const h = all.find((p) => p.userId === userId)?.handle;
  return h ? formatHandle(h) : undefined;
}

function noticeText(notice: Notice, animals: readonly PlacedAnimal[], social: SocialState | null): string {
  switch (notice.kind) {
    case 'animals_departed': {
      const only = notice.animalIds.length === 1 ? animals.find((a) => a.id === notice.animalIds[0]) : undefined;
      return strings.notice.animalsDeparted(notice.animalIds.length, notice.gold, only && getSpecies(only.speciesId).name);
    }
    case 'friend_request':
      return strings.notice.friendRequest(handleOf(social, notice.userId));
    case 'friend_accepted':
      return strings.notice.friendAccepted(handleOf(social, notice.userId));
    case 'together_invite':
      return strings.notice.togetherInvite(handleOf(social, notice.hostId));
    default:
      return strings.notice.generic;
  }
}

/** The oldest queued notice (DESIGN.md 7.2a). Mounted on Home and Break only; the store never shows one during Focus. */
export function NoticeCard() {
  const row = useApp((s) => selectCurrentNotice(s));
  const animals = useApp((s) => s.animals);
  const social = useApp((s) => s.social);
  const dismiss = useApp((s) => s.dismissNotice);
  const joinRoom = useApp((s) => s.joinRoom);
  if (!row) return null;
  const invite = row.notice.kind === 'together_invite' ? row.notice : null;
  return (
    <Panel key={row.id} className={styles.card} role="status">
      <p className={`${styles.text} type-body-md`}>{noticeText(row.notice, animals, social)}</p>
      {invite && (
        <Button
          onClick={() => {
            void dismiss(row.id);
            void joinRoom(invite.roomId);
          }}
        >
          {strings.friends.join}
        </Button>
      )}
      <Button variant="secondary" onClick={() => void dismiss(row.id)}>
        {strings.notice.ok}
      </Button>
    </Panel>
  );
}

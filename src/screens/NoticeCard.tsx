import { formatHandle } from '../../shared/rules/handle';
import type { GroupView, SocialState } from '../../shared/api/types';
import { balance } from '../../shared/balance/balance';
import { runtimeConfig } from '../app/runtimeConfig';
import { getSpecies } from '../domain/animals/catalog';
import type { Notice } from '../domain/inbox/inbox';
import type { PlacedAnimal } from '../domain/types';
import { selectCurrentNotice, useApp } from '../store';
import { strings } from '../ui/strings';
import { Button } from '../ui/components/Button';
import { Panel } from '../ui/components/Surfaces';
import styles from './NoticeCard.module.css';

const { features } = runtimeConfig;

/** A user's handle when the Friends or Group data knows them (notices carry ids only). */
function handleOf(social: SocialState | null, group: GroupView | null, userId: string): string | undefined {
  const all = [...(social ? [...social.friends, ...social.incoming, ...social.outgoing] : []), ...(group?.members.map((m) => m.person) ?? [])];
  const h = all.find((p) => p.userId === userId)?.handle;
  return h ? formatHandle(h) : undefined;
}

function noticeText(notice: Notice, animals: readonly PlacedAnimal[], social: SocialState | null, group: GroupView | null): string {
  const who = (id: string) => handleOf(social, group, id);
  switch (notice.kind) {
    case 'animals_departed': {
      const only = notice.animalIds.length === 1 ? animals.find((a) => a.id === notice.animalIds[0]) : undefined;
      return strings.notice.animalsDeparted(notice.animalIds.length, notice.gold, only && getSpecies(only.speciesId).name);
    }
    case 'friend_request':
      return strings.notice.friendRequest(who(notice.userId));
    case 'friend_accepted':
      return strings.notice.friendAccepted(who(notice.userId));
    case 'together_invite':
      return strings.notice.togetherInvite(who(notice.hostId));
    case 'weekly_result':
      if (notice.youWon) return strings.notice.weeklyWon(notice.gold);
      return notice.winnerIds.length ? strings.notice.weeklyOther(notice.winnerIds.map((id) => who(id)).filter(Boolean).join(', ') || undefined) : strings.notice.weeklyNone;
    case 'mission_milestone':
      return strings.notice.mission(Math.round((balance.missions.milestones[notice.milestone] ?? 0) * 100), notice.gold);
    case 'joined_group':
      return strings.notice.joinedGroup(notice.userId ? who(notice.userId) : undefined);
    case 'removed_from_group':
      return strings.notice.removedFromGroup;
    case 'group_invite':
      return strings.notice.groupInvite(who(notice.inviterId));
    case 'war_report':
      return notice.role === 'defender'
        ? strings.notice.warDefender(notice.opponentId ? who(notice.opponentId) : undefined, strings.stats.clock(notice.at ?? Date.now()), notice.result === 'win', notice.vanished ?? 0, -(notice.gold ?? 0))
        : strings.notice.warAttacker(notice.result === 'win', notice.gold ?? 0);
    default:
      return strings.notice.generic;
  }
}

/** The oldest queued notice (DESIGN.md 7.2a). Mounted on Home and Break only; the store never shows one during Focus. */
export function NoticeCard() {
  const row = useApp((s) => selectCurrentNotice(s));
  const animals = useApp((s) => s.animals);
  const social = useApp((s) => s.social);
  const group = useApp((s) => s.group);
  const dismiss = useApp((s) => s.dismissNotice);
  const joinRoom = useApp((s) => s.joinRoom);
  const setTab = useApp((s) => s.setTab);
  const watchWar = useApp((s) => s.watchWar);
  if (!row) return null;
  const invite = row.notice.kind === 'together_invite' ? row.notice : null;
  const groupInvite = row.notice.kind === 'group_invite' && features.groups;
  const replay = row.notice.kind === 'war_report' && row.notice.role === 'defender' && features.war ? row.notice.warId : null;
  return (
    <Panel key={row.id} className={styles.card} role="status">
      <p className={`${styles.text} type-body-md`}>{noticeText(row.notice, animals, social, group)}</p>
      {groupInvite && (
        <Button
          onClick={() => {
            void dismiss(row.id);
            setTab('group');
          }}
        >
          {strings.group.join}
        </Button>
      )}
      {replay && (
        <Button
          onClick={() => {
            void dismiss(row.id);
            void watchWar(replay);
          }}
        >
          {strings.war.watchReplay}
        </Button>
      )}
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

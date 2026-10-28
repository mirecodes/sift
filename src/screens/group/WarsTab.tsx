import { useEffect, useState } from 'react';
import type { GroupView } from '../../../shared/api/types';
import { deepLinkUrl } from '../../../shared/rules/links';
import { runtimeConfig } from '../../app/runtimeConfig';
import { useApp } from '../../store';
import { useNow } from '../../ui/hooks';
import { strings } from '../../ui/strings';
import { Button } from '../../ui/components/Button';
import { PersonRow } from '../friends/Person';
import f from '../friends/Friends.module.css';
import styles from './War.module.css';

/** The Wars sub-tab (Step 9.8): the last 20 wars involving the user, with replay and a share link. */
export function WarsTab({ group }: { group: GroupView }) {
  const wars = useApp((s) => s.wars);
  const loadWars = useApp((s) => s.loadWars);
  const watchWar = useApp((s) => s.watchWar);
  const now = useNow(60_000);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    void loadWars();
  }, [loadWars, group.id]);
  if (!wars.length) return <p className={`${f.muted} type-body-md`}>{strings.war.none}</p>;
  return (
    <ul className={f.list}>
      {wars.map((w) => (
        <PersonRow
          key={w.id}
          person={w.opponent}
          sub={
            <span className={`${f.muted} type-caption`}>
              {w.role === 'attacker' ? strings.war.youAttacked : strings.war.attackedYou} · {strings.friends.ago(now - w.createdAt)}
              {' · '}
              <span className={`${w.won ? styles.badgeWon : styles.badgeLost} type-caption`}>{w.won ? strings.war.won : strings.war.lost}</span>
              {strings.war.summary(w.lost, w.gold) && ` · ${strings.war.summary(w.lost, w.gold)}`}
            </span>
          }
        >
          <Button variant="secondary" className={f.small} onClick={() => void watchWar(w.id)}>
            {strings.war.replay}
          </Button>
          <Button
            variant="secondary"
            className={f.small}
            onClick={async () => {
              await navigator.clipboard?.writeText(deepLinkUrl(runtimeConfig.links.origin || location.origin, { kind: 'war', id: w.id })).catch(() => undefined);
              setCopied(w.id);
            }}
          >
            {copied === w.id ? strings.friends.copied : strings.war.share}
          </Button>
        </PersonRow>
      ))}
    </ul>
  );
}

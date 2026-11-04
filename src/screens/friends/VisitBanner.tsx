import { useEffect, useState } from 'react';
import { formatHandle } from '../../../shared/rules/handle';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { Button, IconButton } from '../../ui/components/Button';
import { Panel } from '../../ui/components/Surfaces';
import { PersonMenu } from './FriendSheets';
import styles from './Friends.module.css';

/** Visit mode (Step 7.4, DESIGN.md 7.12): whose island this is, Report/Block, and Back (or Esc). */
export function VisitBanner() {
  const visit = useApp((s) => s.visit);
  const leaveVisit = useApp((s) => s.leaveVisit);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !menu && leaveVisit();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leaveVisit, menu]);
  if (!visit) return null;
  const name = visit.handle ? formatHandle(visit.handle) : '…';
  const person = { userId: visit.userId, handle: visit.handle, avatarSpeciesId: visit.animals.at(-1)?.speciesId ?? null, focusing: false };
  return (
    <>
      <Panel className={styles.banner}>
        <p className={`${styles.title} type-body-md-strong`}>{strings.friends.visitBanner(name)}</p>
        <IconButton aria-label={strings.friends.more(name)} onClick={() => setMenu(true)}>
          <span aria-hidden="true">⋯</span>
        </IconButton>
        <Button variant="secondary" onClick={leaveVisit}>
          {strings.friends.back}
        </Button>
      </Panel>
      {menu && (
        <PersonMenu
          person={person}
          context="visit"
          friend={false}
          onClose={() => {
            setMenu(false);
          }}
        />
      )}
    </>
  );
}

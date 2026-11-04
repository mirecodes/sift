import { useEffect, useState } from 'react';
import type { WarView } from '../../../shared/api/types';
import { formatHandle } from '../../../shared/rules/handle';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { Button } from '../../ui/components/Button';
import { Panel } from '../../ui/components/Surfaces';
import type { WarReplayRefs } from '../../world/sequences/WarReplay';
import styles from './War.module.css';

/** The viewer's side of a war: their army, what fell and what left for good, and gold. */
function outcome(war: WarView, me: string | null) {
  const side = war.attacker.userId === me ? 'attacker' : war.defender.userId === me ? 'defender' : null;
  const army = side === 'attacker' ? war.attackers : side === 'defender' ? war.defenders : [];
  const fell = army.filter((f) => war.fallen.includes(f.id)).length;
  const gone = army.filter((f) => war.vanished.includes(f.id)).length;
  const won = side !== null && war.winner === side;
  const gold = side === 'attacker' ? war.lootGold : side === 'defender' ? -war.lootGold : 0;
  return { side, won, home: army.length - fell, fell, gone, gold };
}

/**
 * Over the battle replay (DESIGN.md 7.15): Skip and 2× while it plays, then the result panel with Watch
 * again and Done. Esc skips. Reduced motion shows the result at once.
 */
export function WarScreen({ refs, done, onReplay }: { refs: WarReplayRefs; done: boolean; onReplay: () => void }) {
  const war = useApp((s) => s.war);
  const me = useApp((s) => s.account.userId);
  const closeWar = useApp((s) => s.closeWar);
  const [fast, setFast] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') refs.skip.current = true;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [refs]);
  if (!war) return null;
  if (!done)
    return (
      <div className={styles.controls}>
        <Button variant="secondary" onClick={() => (refs.skip.current = true)}>
          {strings.war.skip}
        </Button>
        <Button
          variant="secondary"
          aria-pressed={fast}
          onClick={() => {
            refs.speed.current = fast ? 1 : 2;
            setFast(!fast);
          }}
        >
          {strings.war.fast}
        </Button>
      </div>
    );
  const o = outcome(war, me);
  const winnerName = war.winner === 'attacker' ? war.attacker : war.defender;
  return (
    <Panel className={styles.result} role="status">
      <h2 className="type-display-sm">{o.side ? (o.won ? strings.war.victory : strings.war.defeat) : strings.war.spectator(winnerName.handle ? formatHandle(winnerName.handle) : '…')}</h2>
      {o.side && <p className="type-body-md">{strings.war.army(o.home, o.fell)}</p>}
      {o.gone > 0 && <p className={`${styles.loss} type-body-md`}>{strings.war.leftForGood(o.gone)}</p>}
      {o.gold !== 0 && <p className="type-body-md-strong">{strings.war.goldDelta(o.gold)}</p>}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onReplay}>
          {strings.war.watchAgain}
        </Button>
        <Button onClick={closeWar}>{strings.war.done}</Button>
      </div>
    </Panel>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { MemberView, WarPreview } from '../../../shared/api/types';
import { formatHandle } from '../../../shared/rules/handle';
import { useApp } from '../../store';
import type { Outcome } from '../../store/social';
import { strings } from '../../ui/strings';
import { TierBadge } from '../../ui/components/Badge';
import { Button } from '../../ui/components/Button';
import { Sheet, sheetStyles, type SheetHandle } from '../../ui/components/Sheet';
import styles from './War.module.css';

function ArmyList({ title, counts, note }: { title: string; counts: number[]; note?: string }) {
  return (
    <div className={styles.army}>
      <p className="type-eyebrow">{title}</p>
      <ul className={styles.tiers}>
        {[3, 2, 1, 0].map((rank) =>
          counts[rank] ? (
            <li key={rank}>
              <TierBadge rank={rank as 0 | 1 | 2 | 3} />
              <span className="type-body-md-strong">×{counts[rank]}</span>
            </li>
          ) : null,
        )}
        {counts.every((n) => n === 0) && <li className="type-body-sm">—</li>}
      </ul>
      {note && <p className={`${sheetStyles.note} type-body-sm`}>{note}</p>}
    </div>
  );
}

/** The Attack confirm sheet (Step 9.6, DESIGN.md 7.15). */
export function AttackSheet({ target, onClose }: { target: MemberView; onClose: () => void }) {
  const sheet = useRef<SheetHandle>(null);
  const previewWar = useApp((s) => s.previewWar);
  const declareWar = useApp((s) => s.declareWar);
  const [preview, setPreview] = useState<WarPreview | null>(null);
  const [error, setError] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void previewWar(target.person.userId).then((p) => (typeof p === 'object' && p ? setPreview(p) : setError(p)));
  }, [previewWar, target.person.userId]);
  const name = target.person.handle ? formatHandle(target.person.handle) : '…';
  const blocked = preview?.blocked;
  const hours = blocked?.until ? Math.max(1, Math.ceil((blocked.until - Date.now()) / 3_600_000)) : 0;
  const attack = async () => {
    setBusy(true);
    const outcome = await declareWar(target.person.userId);
    setBusy(false);
    if (outcome) setError(outcome);
    else sheet.current?.close();
  };
  return (
    <Sheet ref={sheet} title={strings.war.attackTitle(name)} onClose={onClose} wide>
      {preview && (
        <>
          <div className={styles.armies}>
            <ArmyList title={strings.war.yourArmy} counts={preview.attackers} {...(preview.unicornsHome > 0 && { note: strings.war.unicornsHome })} />
            <ArmyList title={strings.war.theirArmy} counts={preview.defenders} />
          </div>
          <p className="type-body-md">{strings.war.ifWin(preview.lootIfWin)}</p>
          <p className={`${sheetStyles.note} type-body-sm`}>{strings.war.odds}</p>
          <p className={`${sheetStyles.note} type-body-sm`}>{strings.war.cooldownNote}</p>
        </>
      )}
      {(blocked || error) && (
        <p className={`${sheetStyles.error} type-body-sm`} role="alert">
          {blocked ? (strings.war.blocked[blocked.code]?.(hours) ?? strings.war.errors.generic) : (strings.war.blocked[error!]?.(hours) ?? strings.war.errors[error!] ?? strings.war.errors.generic)}
        </p>
      )}
      <div className={sheetStyles.actions}>
        <Button variant="secondary" onClick={() => sheet.current?.close()}>
          {strings.war.cancel}
        </Button>
        <Button disabled={!preview || !!blocked || busy} onClick={() => void attack()}>
          {strings.war.attack}
        </Button>
      </div>
    </Sheet>
  );
}

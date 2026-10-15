import { getSpecies } from '../domain/animals/catalog';
import type { Notice } from '../domain/inbox/inbox';
import type { PlacedAnimal } from '../domain/types';
import { selectCurrentNotice, useApp } from '../store';
import { strings } from '../ui/strings';
import { Button } from '../ui/components/Button';
import { Panel } from '../ui/components/Surfaces';
import styles from './NoticeCard.module.css';

function noticeText(notice: Notice, animals: readonly PlacedAnimal[]): string {
  switch (notice.kind) {
    case 'animals_departed': {
      const only = notice.animalIds.length === 1 ? animals.find((a) => a.id === notice.animalIds[0]) : undefined;
      return strings.notice.animalsDeparted(notice.animalIds.length, notice.gold, only && getSpecies(only.speciesId).name);
    }
    default:
      return strings.notice.generic;
  }
}

/** The oldest queued notice (DESIGN.md 7.2a). Mounted on Home and Break only; the store never shows one during Focus. */
export function NoticeCard() {
  const row = useApp((s) => selectCurrentNotice(s));
  const animals = useApp((s) => s.animals);
  const dismiss = useApp((s) => s.dismissNotice);
  if (!row) return null;
  return (
    <Panel key={row.id} className={styles.card} role="status">
      <p className={`${styles.text} type-body-md`}>{noticeText(row.notice, animals)}</p>
      <Button variant="secondary" onClick={() => void dismiss(row.id)}>
        {strings.notice.ok}
      </Button>
    </Panel>
  );
}

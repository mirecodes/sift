import { useEffect, useRef } from 'react';
import { getSpecies } from '../../domain/animals/catalog';
import { countsInStats, sessionsOnDay } from '../../domain/stats/days';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { TierBadge } from '../../ui/components/Badge';
import { IconButton } from '../../ui/components/Button';
import { CloseIcon } from '../../ui/components/Icons';
import { VoxelSprite } from '../collection/VoxelSprite';
import styles from './Stats.module.css';

const MIN = 60_000;

/** One day's sessions in a native modal dialog (DESIGN.md 7.6). */
export function DayDetail({ date, timeZone, onClose }: { date: string; timeZone: string; onClose: () => void }) {
  const sessions = useApp((s) => s.sessions);
  const animals = useApp((s) => s.animals);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const list = sessionsOnDay(sessions, date, timeZone);
  const counted = list.filter(countsInStats);
  const total = counted.reduce((sum, s) => sum + (s.endedAt - s.startedAt) / MIN, 0);
  const { duration } = strings.stats;

  return (
    <dialog ref={ref} className={styles.sheet} onClose={onClose} aria-labelledby="day-title">
      <div className={styles.sheetHead}>
        <h2 id="day-title" className="type-display-sm">
          {strings.stats.dayTitle(date)}
        </h2>
        <IconButton aria-label={strings.aria.close} onClick={() => ref.current?.close()}>
          <CloseIcon />
        </IconButton>
      </div>
      <p className={`${styles.note} type-body-sm`}>{strings.stats.daySummary(duration(total), counted.length)}</p>
      {list.length === 0 ? (
        <p className={`${styles.empty} type-body-md`}>{strings.stats.noSessions}</p>
      ) : (
        <ul className={styles.sessions}>
          {list.map((s) => {
            const minutes = (s.endedAt - s.startedAt) / MIN;
            const stopped = !countsInStats(s);
            const overtime = minutes - s.plannedFocusMs / MIN;
            const animal = s.rewardAnimalId ? animals.find((a) => a.id === s.rewardAnimalId) : undefined;
            const species = animal && getSpecies(animal.speciesId);
            return (
              <li key={s.id} className={styles.session} data-stopped={stopped || undefined}>
                <div>
                  <p className="type-body-md-strong">{strings.stats.clock(s.startedAt)}</p>
                  <p className="type-body-sm">
                    {stopped
                      ? strings.stats.stopped(duration(minutes))
                      : `${duration(minutes)}${overtime >= 1 ? ` · ${strings.stats.overtime(duration(overtime))}` : ''}`}
                  </p>
                </div>
                {!stopped && animal && species && (
                  <div className={styles.reward} role="img" aria-label={species.name} title={species.name}>
                    <VoxelSprite modelId={species.modelId} size={48} />
                    <TierBadge rank={animal.tierRank} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </dialog>
  );
}

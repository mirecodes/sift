import type { DayStat, MonthSummary } from '../../domain/stats/days';
import { strings } from '../../ui/strings';
import { FeatureCard } from '../../ui/components/Surfaces';
import { Nav } from './Nav';
import styles from './Stats.module.css';

interface Props {
  days: readonly DayStat[];
  summary: MonthSummary;
  today: string;
  canGoNext: boolean;
  onShift: (weeks: number) => void;
  onSelect: (date: string) => void;
}

/** Seven columns, one per day (DESIGN.md 7.6). */
export function WeekView({ days, summary, today, canGoNext, onShift, onSelect }: Props) {
  const { duration } = strings.stats;
  const max = Math.max(1, ...days.map((d) => d.focusMinutes));
  const first = days[0]?.date ?? today;
  const last = days[days.length - 1]?.date ?? today;
  return (
    <section>
      <h2 className={`${styles.section} type-eyebrow`}>{strings.stats.week}</h2>
      <Nav
        label={strings.stats.weekRange(first, last)}
        previous={strings.stats.previousWeek}
        next={strings.stats.nextWeek}
        canGoNext={canGoNext}
        onShift={onShift}
      />
      <p className={`${styles.note} ${styles.sub} type-body-sm`}>{strings.stats.weekTotal(duration(summary.totalMinutes), duration(summary.dailyAverage))}</p>
      <FeatureCard className={`${styles.card} ${styles.week}`}>
        {days.map((d) => {
          const future = d.date > today;
          const time = duration(d.focusMinutes);
          return (
            <button
              key={d.date}
              type="button"
              className={styles.day}
              data-today={d.date === today || undefined}
              disabled={future}
              aria-label={strings.stats.dayLabel(d.date, time, d.sessionCount)}
              onClick={() => onSelect(d.date)}
            >
              <span className="type-eyebrow-sm">{strings.stats.weekday(d.date)}</span>
              <span className="type-body-sm-strong">{strings.stats.dayOfMonth(d.date)}</span>
              <span className={styles.dayBars}>{!future && <span className={styles.bar} style={{ height: `${(d.focusMinutes / max) * 100}%` }} />}</span>
              <span className={`${styles.value} type-caption`}>{future ? '' : time}</span>
              <span className={`${styles.note} type-caption`}>{d.sessionCount ? strings.collection.count(d.sessionCount) : ''}</span>
            </button>
          );
        })}
      </FeatureCard>
    </section>
  );
}

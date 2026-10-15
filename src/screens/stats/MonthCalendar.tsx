import { config } from '../../domain/config';
import { addDays, heatLevel, weekStart, weekday, type DayStat } from '../../domain/stats/days';
import { strings } from '../../ui/strings';
import { FeatureCard } from '../../ui/components/Surfaces';
import styles from './Stats.module.css';

interface Props {
  days: readonly DayStat[];
  today: string;
  weekStartsOn: 0 | 1;
  onSelect: (date: string) => void;
}

/** Month heatmap: one button per day with time and count (DESIGN.md 7.6). */
export function MonthCalendar({ days, today, weekStartsOn, onSelect }: Props) {
  const first = days[0]?.date ?? today;
  const lead = (weekday(first) - weekStartsOn + 7) % 7;
  const header = Array.from({ length: 7 }, (_, i) => addDays(weekStart(first, weekStartsOn), i));
  const { duration } = strings.stats;
  return (
    <section>
      <h2 className={`${styles.section} type-eyebrow`}>{strings.stats.monthSection}</h2>
      <FeatureCard className={`${styles.card} ${styles.calendar}`}>
        {header.map((d) => (
          <span key={d} className={`${styles.note} ${styles.calendarHead} type-eyebrow-sm`} aria-hidden="true">
            {strings.stats.weekday(d)}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {days.map((d) => {
          const future = d.date > today;
          const time = duration(d.focusMinutes);
          return (
            <button
              key={d.date}
              type="button"
              className={`${styles.cell} type-caption`}
              data-heat={future ? undefined : heatLevel(d.focusMinutes, config.ui.heatMinutes)}
              data-today={d.date === today || undefined}
              disabled={future}
              aria-label={strings.stats.dayLabel(d.date, time, d.sessionCount)}
              onClick={() => onSelect(d.date)}
            >
              <span className={styles.cellDate}>{strings.stats.dayOfMonth(d.date)}</span>
              {!future && <span>{d.sessionCount ? strings.stats.durationShort(d.focusMinutes) : strings.stats.none}</span>}
              {!future && d.sessionCount > 0 && <span>{strings.collection.count(d.sessionCount)}</span>}
            </button>
          );
        })}
      </FeatureCard>
    </section>
  );
}

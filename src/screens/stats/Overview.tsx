import type { DayStat, MonthSummary } from '../../domain/stats/days';
import { strings } from '../../ui/strings';
import { FeatureCard } from '../../ui/components/Surfaces';
import styles from './Stats.module.css';

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={styles.figure}>
      <p className={`${styles.label} type-eyebrow-sm`}>{label}</p>
      <p className={`${styles.value} type-display-xs`}>{value}</p>
      {note && <p className={`${styles.note} type-caption`}>{note}</p>}
    </div>
  );
}

/** Month overview: daily average, totals and a bar per day (DESIGN.md 7.6). */
export function Overview({ days, summary, today }: { days: readonly DayStat[]; summary: MonthSummary; today: string }) {
  const max = Math.max(1, ...days.map((d) => d.focusMinutes));
  const { duration } = strings.stats;
  return (
    <FeatureCard className={styles.card}>
      <p className={`${styles.label} type-eyebrow`}>{strings.stats.dailyAverage}</p>
      <p className={styles.average}>
        <span className="type-display-lg">{duration(summary.dailyAverage)}</span>{' '}
        <span className={`${styles.note} type-body-md`}>{strings.stats.perDay}</span>
      </p>
      <div className={styles.figures}>
        <Figure label={strings.stats.total} value={duration(summary.totalMinutes)} />
        <Figure label={strings.stats.activeDays} value={String(summary.activeDays)} />
        <Figure
          label={strings.stats.bestDay}
          value={summary.bestDay ? duration(summary.bestDay.focusMinutes) : strings.stats.none}
          note={summary.bestDay ? strings.stats.shortDate(summary.bestDay.date) : undefined}
        />
      </div>
      <div className={styles.strip} aria-hidden="true">
        {days.map((d) => (
          <span key={d.date} className={styles.stripDay}>
            {d.date <= today && <span className={styles.bar} style={{ height: `${(d.focusMinutes / max) * 100}%` }} />}
          </span>
        ))}
      </div>
    </FeatureCard>
  );
}

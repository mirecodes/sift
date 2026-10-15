import { useMemo, useState } from 'react';
import { addMonths, aggregateByDay, localDate, monthRange, monthSummary } from '../../domain/stats/days';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { IconButton } from '../../ui/components/Button';
import { NextIcon, PrevIcon } from '../../ui/components/Icons';
import { TabPage } from '../TabPage';
import { Overview } from './Overview';
import styles from './Stats.module.css';

/** Stats tab (DESIGN.md 7.6). Days are bucketed in the device's current time zone. */
export function StatsScreen() {
  const sessions = useApp((s) => s.sessions);
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const today = localDate(Date.now(), timeZone);
  const [month, setMonth] = useState(today.slice(0, 7));
  const days = useMemo(() => aggregateByDay(sessions, { timeZone, ...monthRange(month) }), [sessions, timeZone, month]);
  const summary = monthSummary(days, { today });

  return (
    <TabPage title={strings.tabs.stats} wide={styles.wide}>
      <div className={styles.nav}>
        <IconButton aria-label={strings.stats.previousMonth} onClick={() => setMonth(addMonths(month, -1))}>
          <PrevIcon />
        </IconButton>
        <h2 className={`${styles.navLabel} type-display-xs`} aria-live="polite">
          {strings.stats.month(month)}
        </h2>
        <IconButton aria-label={strings.stats.nextMonth} disabled={month >= today.slice(0, 7)} onClick={() => setMonth(addMonths(month, 1))}>
          <NextIcon />
        </IconButton>
      </div>
      <Overview days={days} summary={summary} today={today} />
    </TabPage>
  );
}

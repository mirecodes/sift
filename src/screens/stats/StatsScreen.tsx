import { useMemo, useState } from 'react';
import { addDays, addMonths, aggregateByDay, localDate, monthRange, monthSummary, weekStart } from '../../domain/stats/days';
import { useApp } from '../../store';
import { strings } from '../../ui/strings';
import { TabPage } from '../TabPage';
import { DayDetail } from './DayDetail';
import { MonthCalendar } from './MonthCalendar';
import { Nav } from './Nav';
import { Overview } from './Overview';
import { WeekView } from './WeekView';
import styles from './Stats.module.css';

/** Stats tab (DESIGN.md 7.6). Days are bucketed in the device's current time zone. */
export function StatsScreen() {
  const sessions = useApp((s) => s.sessions);
  const weekStartsOn = useApp((s) => s.settings.weekStartsOn);
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const today = localDate(Date.now(), timeZone);
  const thisWeek = weekStart(today, weekStartsOn);

  const [month, setMonth] = useState(today.slice(0, 7));
  /** Weeks back from the current week (0 = this week), so a Week-starts-on change keeps the view. */
  const [weeksBack, setWeeksBack] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const monthDays = useMemo(() => aggregateByDay(sessions, { timeZone, ...monthRange(month) }), [sessions, timeZone, month]);
  const from = addDays(thisWeek, -7 * weeksBack);
  const weekDays = useMemo(() => aggregateByDay(sessions, { timeZone, from, to: addDays(from, 6) }), [sessions, timeZone, from]);

  return (
    <TabPage title={strings.tabs.stats} wide={styles.wide}>
      <Nav
        label={strings.stats.month(month)}
        previous={strings.stats.previousMonth}
        next={strings.stats.nextMonth}
        canGoNext={month < today.slice(0, 7)}
        onShift={(by) => setMonth(addMonths(month, by))}
      />
      <Overview days={monthDays} summary={monthSummary(monthDays, { today })} today={today} />
      <MonthCalendar days={monthDays} today={today} weekStartsOn={weekStartsOn} onSelect={setSelected} />
      <WeekView
        days={weekDays}
        summary={monthSummary(weekDays, { today })}
        today={today}
        canGoNext={weeksBack > 0}
        onShift={(by) => setWeeksBack(weeksBack - by)}
        onSelect={setSelected}
      />
      {selected && <DayDetail key={selected} date={selected} timeZone={timeZone} onClose={() => setSelected(null)} />}
    </TabPage>
  );
}

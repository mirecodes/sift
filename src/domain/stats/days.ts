import { balance } from '../../../shared/balance/balance';
import type { FocusSession } from '../types';

/**
 * Per-day focus statistics (guidance_v2 Step 1.2, ADR-037). Times are stored as UTC epoch ms;
 * a session belongs to the local calendar day (in `timeZone`) on which it started. Dates are
 * `YYYY-MM-DD` strings; calendar arithmetic on them runs in UTC, which has no DST.
 */
export interface DayStat {
  date: string;
  focusMinutes: number;
  sessionCount: number;
}

export interface MonthSummary {
  totalMinutes: number;
  dailyAverage: number;
  activeDays: number;
  bestDay: DayStat | null;
}

const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

/** The local calendar date of `ms` in an IANA time zone. */
export function localDate(ms: number, timeZone: string): string {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    formatters.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(ms).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

const toUtc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

/** First day of the week containing `date`. */
export function weekStart(date: string, weekStartsOn: 0 | 1): string {
  return addDays(date, -((weekday(date) - weekStartsOn + 7) % 7));
}

/** `YYYY-MM` → first and last date of that month. */
export function monthRange(month: string): { from: string; to: string } {
  const from = `${month}-01`;
  const next = new Date(toUtc(from));
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from, to: addDays(fromUtc(next.getTime()), -1) };
}

/** `YYYY-MM` shifted by `n` months. */
export function addMonths(month: string, n: number): string {
  const d = new Date(toUtc(`${month}-01`));
  d.setUTCMonth(d.getUTCMonth() + n);
  return fromUtc(d.getTime()).slice(0, 7);
}

/** Sessions that count: completed (and abandoned if the balance says so) with an end time. */
export function countsInStats(s: FocusSession): s is FocusSession & { endedAt: number } {
  if (s.endedAt === undefined) return false;
  return s.status === 'completed' || (s.status === 'abandoned' && balance.stats.includeAbandoned);
}

/**
 * One entry per day from `from` to `to` (inclusive), zeros included. Minutes are the real focused
 * time `endedAt - startedAt` (planned + overtime), not the reward cap.
 */
export function aggregateByDay(
  sessions: readonly FocusSession[],
  { timeZone, from, to }: { timeZone: string; from: string; to: string },
): DayStat[] {
  const days: DayStat[] = [];
  const byDate = new Map<string, DayStat>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const day = { date: d, focusMinutes: 0, sessionCount: 0 };
    days.push(day);
    byDate.set(d, day);
  }
  for (const s of sessions) {
    if (!countsInStats(s)) continue;
    const day = byDate.get(localDate(s.startedAt, timeZone));
    if (!day) continue;
    day.focusMinutes += Math.max(0, s.endedAt - s.startedAt) / 60_000;
    day.sessionCount += 1;
  }
  return days;
}

/** Finished sessions (completed or abandoned) that started on `date` in `timeZone`, oldest first. */
export function sessionsOnDay(sessions: readonly FocusSession[], date: string, timeZone: string): (FocusSession & { endedAt: number })[] {
  return sessions
    .filter((s): s is FocusSession & { endedAt: number } => s.endedAt !== undefined && s.status !== 'running' && localDate(s.startedAt, timeZone) === date)
    .sort((a, b) => a.startedAt - b.startedAt);
}

/** Heatmap level 0…steps.length: how many thresholds (ascending, in minutes) the day reaches. */
export function heatLevel(minutes: number, steps: readonly number[]): number {
  return steps.filter((s) => minutes >= s).length;
}

/**
 * Summary of one month's `dayStats`. Daily average = total ÷ days elapsed: through `today`
 * (inclusive) in the current month, every day in past months, 0 for future months.
 */
export function monthSummary(dayStats: readonly DayStat[], { today }: { today: string }): MonthSummary {
  const elapsed = dayStats.filter((d) => d.date <= today).length;
  const totalMinutes = dayStats.reduce((sum, d) => sum + d.focusMinutes, 0);
  let bestDay: DayStat | null = null;
  for (const d of dayStats) if (d.focusMinutes > 0 && (!bestDay || d.focusMinutes > bestDay.focusMinutes)) bestDay = d;
  return {
    totalMinutes,
    dailyAverage: elapsed ? totalMinutes / elapsed : 0,
    activeDays: dayStats.filter((d) => d.sessionCount > 0).length,
    bestDay,
  };
}

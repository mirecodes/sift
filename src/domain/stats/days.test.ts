import { describe, expect, it } from 'vitest';
import type { FocusSession } from '../types';
import { addDays, addMonths, aggregateByDay, heatLevel, localDate, monthRange, monthSummary, weekStart } from './days';

const MIN = 60_000;
const ZH = 'Europe/Zurich';

let n = 0;
function session(startIso: string, minutes: number, status: FocusSession['status'] = 'completed'): FocusSession {
  const startedAt = Date.parse(startIso);
  return {
    id: `s${++n}`,
    startedAt,
    plannedFocusMs: 25 * MIN,
    status,
    togetherRoomId: null,
    ...(status !== 'running' && { endedAt: startedAt + minutes * MIN, effectiveFocusMs: Math.min(60, minutes) * MIN }),
  };
}

describe('calendar helpers', () => {
  it('local date follows the time zone', () => {
    expect(localDate(Date.parse('2026-10-06T22:30:00Z'), ZH)).toBe('2026-10-07');
    expect(localDate(Date.parse('2026-10-06T22:30:00Z'), 'UTC')).toBe('2026-10-06');
    expect(localDate(Date.parse('2026-10-07T03:00:00Z'), 'America/Los_Angeles')).toBe('2026-10-06');
  });

  it('week starts on Monday or Sunday', () => {
    expect(weekStart('2026-10-07', 1)).toBe('2026-10-05'); // Wednesday
    expect(weekStart('2026-10-07', 0)).toBe('2026-10-04');
    expect(weekStart('2026-10-11', 1)).toBe('2026-10-05'); // Sunday ends a Monday week
    expect(weekStart('2026-10-11', 0)).toBe('2026-10-11'); // and starts a Sunday week
    expect(weekStart('2026-10-05', 1)).toBe('2026-10-05');
  });

  it('months: lengths, leap years, year boundaries', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2028-02').to).toBe('2028-02-29');
    expect(monthRange('2026-02').to).toBe('2026-02-28');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('aggregateByDay', () => {
  it('returns one entry per day, zeros included', () => {
    const days = aggregateByDay([], { timeZone: ZH, from: '2026-10-01', to: '2026-10-31' });
    expect(days).toHaveLength(31);
    expect(days.every((d) => d.focusMinutes === 0 && d.sessionCount === 0)).toBe(true);
  });

  it('a session across midnight belongs to the day it started, with its full length', () => {
    // 23:50 local on 6 Oct (Zurich, CEST = UTC+2) for 50 minutes.
    const days = aggregateByDay([session('2026-10-06T21:50:00Z', 50)], { timeZone: ZH, from: '2026-10-06', to: '2026-10-07' });
    expect(days).toEqual([
      { date: '2026-10-06', focusMinutes: 50, sessionCount: 1 },
      { date: '2026-10-07', focusMinutes: 0, sessionCount: 0 },
    ]);
  });

  it('counts real focused time (planned + overtime), not the 60 minute reward cap', () => {
    const [day] = aggregateByDay([session('2026-10-07T08:00:00Z', 95)], { timeZone: ZH, from: '2026-10-07', to: '2026-10-07' });
    expect(day?.focusMinutes).toBe(95);
  });

  it('only completed sessions count; abandoned and running are excluded', () => {
    const sessions = [session('2026-10-07T08:00:00Z', 30), session('2026-10-07T09:00:00Z', 10, 'abandoned'), session('2026-10-07T10:00:00Z', 0, 'running')];
    const [day] = aggregateByDay(sessions, { timeZone: ZH, from: '2026-10-07', to: '2026-10-07' });
    expect(day).toEqual({ date: '2026-10-07', focusMinutes: 30, sessionCount: 1 });
  });

  it('DST start week (Zurich, last Sunday of March): seven days, correct buckets and lengths', () => {
    const sessions = [
      session('2026-03-28T23:30:00Z', 30), // 00:30 CET Sun 29 Mar
      session('2026-03-29T00:30:00Z', 60), // 01:30 CET → 03:30 CEST: one real hour
      session('2026-03-29T21:30:00Z', 30), // 23:30 CEST Sun 29 Mar
      session('2026-03-29T22:30:00Z', 30), // 00:30 CEST Mon 30 Mar: next week
    ];
    const from = weekStart('2026-03-29', 1);
    const days = aggregateByDay(sessions, { timeZone: ZH, from, to: addDays(from, 6) });
    expect(days.map((d) => d.date)).toEqual(['2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29']);
    expect(days[6]).toEqual({ date: '2026-03-29', focusMinutes: 120, sessionCount: 3 });
    expect(days[5]?.sessionCount).toBe(0);
  });

  it('DST end week (Zurich, last Sunday of October): seven days, correct buckets', () => {
    const sessions = [
      session('2026-10-24T22:30:00Z', 25), // 00:30 CEST Sun 25 Oct
      session('2026-10-25T00:30:00Z', 25), // 02:30 CEST, the first of the two 02:30s
      session('2026-10-25T01:30:00Z', 25), // 02:30 CET, the repeated hour
      session('2026-10-25T22:30:00Z', 25), // 23:30 CET Sun 25 Oct
      session('2026-10-25T23:30:00Z', 25), // 00:30 CET Mon 26 Oct
    ];
    const from = weekStart('2026-10-25', 1);
    const days = aggregateByDay(sessions, { timeZone: ZH, from, to: addDays(from, 6) });
    expect(days).toHaveLength(7);
    expect(days[0]?.date).toBe('2026-10-19');
    expect(days[6]).toEqual({ date: '2026-10-25', focusMinutes: 100, sessionCount: 4 });
  });

  it('a Sunday-start week buckets the same sessions differently', () => {
    const sessions = [session('2026-10-11T08:00:00Z', 30)]; // Sunday 11 Oct
    const mon = aggregateByDay(sessions, { timeZone: ZH, from: weekStart('2026-10-11', 1), to: addDays(weekStart('2026-10-11', 1), 6) });
    const sun = aggregateByDay(sessions, { timeZone: ZH, from: weekStart('2026-10-11', 0), to: addDays(weekStart('2026-10-11', 0), 6) });
    expect(mon[6]).toMatchObject({ date: '2026-10-11', sessionCount: 1 });
    expect(sun[0]).toMatchObject({ date: '2026-10-11', sessionCount: 1 });
  });
});

describe('heatLevel', () => {
  it('counts the thresholds a day reaches', () => {
    const steps = [1, 30, 60, 120];
    expect([0, 0.5, 1, 29, 30, 59, 60, 119, 120, 600].map((m) => heatLevel(m, steps))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('monthSummary', () => {
  const october = (sessions: FocusSession[]) => aggregateByDay(sessions, { timeZone: ZH, ...monthRange('2026-10') });

  it('empty month', () => {
    expect(monthSummary(october([]), { today: '2026-10-07' })).toEqual({ totalMinutes: 0, dailyAverage: 0, activeDays: 0, bestDay: null });
  });

  it('current month: average over day 1 through today inclusive', () => {
    const s = monthSummary(october([session('2026-10-02T08:00:00Z', 60), session('2026-10-07T08:00:00Z', 80)]), { today: '2026-10-07' });
    expect(s.totalMinutes).toBe(140);
    expect(s.dailyAverage).toBe(20);
    expect(s.activeDays).toBe(2);
    expect(s.bestDay).toMatchObject({ date: '2026-10-07', focusMinutes: 80 });
  });

  it('past month: average over every day of the month', () => {
    const s = monthSummary(october([session('2026-10-02T08:00:00Z', 62)]), { today: '2026-11-15' });
    expect(s.dailyAverage).toBe(2);
  });

  it('future month: zero average, no division by zero', () => {
    expect(monthSummary(october([]), { today: '2026-09-30' }).dailyAverage).toBe(0);
  });

  it('best day ties keep the earliest day', () => {
    const s = monthSummary(october([session('2026-10-02T08:00:00Z', 30), session('2026-10-05T08:00:00Z', 30)]), { today: '2026-10-07' });
    expect(s.bestDay?.date).toBe('2026-10-02');
  });
});

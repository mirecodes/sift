import { describe, expect, it } from 'vitest';
import { strings } from './strings';

describe('stats strings', () => {
  it('durations', () => {
    expect([0, 0.9, 42, 60, 102, 125, 760].map(strings.stats.duration)).toEqual(['0m', '0m', '42m', '1h 00m', '1h 42m', '2h 05m', '12h 40m']);
  });

  it('calendar dates do not shift with the time zone', () => {
    expect(strings.stats.month('2026-10')).toBe('October 2026');
    expect(strings.stats.shortDate('2026-10-04')).toBe('4 Oct');
  });
});

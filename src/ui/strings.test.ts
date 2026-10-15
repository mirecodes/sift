import { describe, expect, it } from 'vitest';
import { strings } from './strings';

describe('poke time left (Step 2.6)', () => {
  it('days from 36 hours, then hours, then under an hour', () => {
    const H = 3_600_000;
    expect([7 * 24 * H - 1, 3 * 24 * H, 36 * H, 35.9 * H, 1 * H, 0.99 * H, 0].map(strings.poke.timeLeft)).toEqual([
      '7d left',
      '3d left',
      '2d left',
      '35h left',
      '1h left',
      '<1h left',
      '<1h left',
    ]);
  });
});

describe('stats strings', () => {
  it('durations', () => {
    expect([0, 0.9, 42, 60, 102, 125, 760].map(strings.stats.duration)).toEqual(['0m', '0m', '42m', '1h 00m', '1h 42m', '2h 05m', '12h 40m']);
  });

  it('short durations for calendar cells', () => {
    expect([0, 42, 60, 98, 605].map(strings.stats.durationShort)).toEqual(['0m', '42m', '1h00', '1h38', '10h05']);
  });

  it('calendar dates do not shift with the time zone', () => {
    expect(strings.stats.month('2026-10')).toBe('October 2026');
    expect(strings.stats.shortDate('2026-10-04')).toBe('4 Oct');
  });
});

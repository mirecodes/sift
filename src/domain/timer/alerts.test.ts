import { describe, expect, it } from 'vitest';
import { liveStateFor, timerAlerts } from './alerts';
import { IDLE, startBreak, startFocus } from './phase';

const focus = startFocus(1_000, 25 * 60_000, 's1');
const brk = startBreak(5_000, 5 * 60_000, 'a1');

describe('timer alerts (Step 6.3)', () => {
  it('schedules the planned end of Focus and of a break', () => {
    expect(timerAlerts(focus, 2_000, true)).toEqual([{ kind: 'focusEnd', at: 1_000 + 25 * 60_000, sound: true }]);
    expect(timerAlerts(brk, 6_000, false)).toEqual([{ kind: 'breakEnd', at: 5_000 + 5 * 60_000, sound: false }]);
  });

  it('schedules nothing when idle or already past the end (stop, end and overtime cancel)', () => {
    expect(timerAlerts(IDLE, 0, true)).toEqual([]);
    expect(timerAlerts(focus, 1_000 + 25 * 60_000, true)).toEqual([]);
    expect(timerAlerts(brk, 5_000 + 5 * 60_000 + 1, true)).toEqual([]);
  });
});

describe('live progress state (Step 6.8)', () => {
  it('shows Focus by dates, including overtime', () => {
    const state = { phase: 'focus', startedAt: 1_000, endsAt: 1_000 + 25 * 60_000 };
    expect(liveStateFor(focus, true, 2_000)).toEqual(state);
    expect(liveStateFor(focus, true, 99 * 60_000)).toEqual(state);
  });

  it('shows a break until it ends, then nothing', () => {
    expect(liveStateFor(brk, true, 6_000)).toEqual({ phase: 'break', startedAt: 5_000, endsAt: 5_000 + 5 * 60_000 });
    expect(liveStateFor(brk, true, 5_000 + 5 * 60_000)).toBeNull();
  });

  it('is off when the setting is off or nothing runs', () => {
    expect(liveStateFor(focus, false, 2_000)).toBeNull();
    expect(liveStateFor(IDLE, true, 2_000)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { seededRng } from '../domain/random';
import type { LiveProgressView, ScheduledAlert } from '../platform';
import { createMemoryStorage } from '../platform/storage/memory';
import { createAppStore } from '../store/appStore';
import { bindPhaseEffects } from './phaseEffects';

const MIN = 60_000;

async function harness() {
  const clock = { t: 1_000_000 };
  let n = 0;
  const store = createAppStore({ storage: createMemoryStorage(), now: () => clock.t, rng: seededRng(1), uuid: () => `id-${++n}` });
  await store.getState().init();
  const scheduled: ScheduledAlert[][] = [];
  const live: (LiveProgressView | null)[] = [];
  const off = bindPhaseEffects(store, { notify: { unlock() {}, play() {}, schedule: (a) => void scheduled.push(a) }, liveProgress: { update: (v) => void live.push(v) } }, () => clock.t);
  return { store, clock, scheduled, live, off, get: store.getState };
}

describe('phase effects (Steps 6.3, 6.8)', () => {
  it('schedules the focus end on start, the break end on the break, and cancels on stop', async () => {
    const h = await harness();
    expect(h.scheduled).toEqual([[]]);
    await h.get().startFocus();
    const plannedMs = h.get().settings.focusMinutes * MIN;
    expect(h.scheduled.at(-1)).toEqual([{ kind: 'focusEnd', at: 1_000_000 + plannedMs, sound: true, title: "Time's up", body: 'Open Sift to end focus.' }]);
    expect(h.live.at(-1)).toMatchObject({ phase: 'focus', startedAt: 1_000_000, endsAt: 1_000_000 + plannedMs, title: 'Focus' });

    h.clock.t += plannedMs + MIN;
    await h.get().endFocus();
    expect(h.scheduled.at(-1)).toMatchObject([{ kind: 'breakEnd', at: h.clock.t + h.get().settings.breakMinutes * MIN }]);
    expect(h.live.at(-1)).toMatchObject({ phase: 'break', title: 'Break' });

    await h.get().startFocus();
    await h.get().abandonFocus();
    expect(h.scheduled.at(-1)).toEqual([]);
    expect(h.live.at(-1)).toBeNull();
    h.off();
  });

  it('follows the Sound and lock-screen settings, and stays quiet when nothing changed', async () => {
    const h = await harness();
    await h.get().startFocus();
    const calls = h.scheduled.length;
    h.get().setView('home');
    expect(h.scheduled).toHaveLength(calls);
    await h.get().updateSettings({ soundEnabled: false, liveProgress: false });
    expect(h.scheduled.at(-1)).toMatchObject([{ kind: 'focusEnd', sound: false }]);
    expect(h.live.at(-1)).toBeNull();
    h.off();
  });
});

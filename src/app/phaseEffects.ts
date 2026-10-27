import type { StoreApi } from 'zustand';
import { liveStateFor, timerAlerts } from '../domain/timer/alerts';
import type { Platform } from '../platform/types';
import type { AppState } from '../store/appStore';
import { strings } from '../ui/strings';

const clock = (at: number) => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(at);

/**
 * Keeps the native timer notifications (Step 6.3) and the lock-screen progress (Step 6.8) in step with
 * the store: on every phase or settings change (start, stop, end, Sound or lock-screen toggles) both are
 * recomputed from timestamps and handed to the platform, only when they changed. Returns unsubscribe.
 */
export function bindPhaseEffects(
  store: StoreApi<AppState>,
  platform: Pick<Platform, 'notify' | 'liveProgress'>,
  opts: { liveProgress: boolean; now?: () => number },
): () => void {
  const now = opts.now ?? Date.now;
  let last = '';
  const apply = (s: AppState) => {
    if (!s.ready) return;
    const at = now();
    const alerts = timerAlerts(s.phase, at, s.settings.soundEnabled).map((a) => ({ ...a, ...strings.alerts[a.kind] }));
    // The lock-screen timer ships behind `features.liveProgress`, then follows the user's setting.
    const live = liveStateFor(s.phase, opts.liveProgress && s.settings.liveProgress, at);
    const view = live && { ...live, title: strings.live[live.phase], detail: strings.live.endsAt(clock(live.endsAt)), overTitle: strings.live.over };
    const key = JSON.stringify([alerts, live]);
    if (key === last) return;
    last = key;
    platform.notify.schedule(alerts);
    platform.liveProgress.update(view);
  };
  apply(store.getState());
  return store.subscribe(apply);
}

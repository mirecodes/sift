import type { LifecycleAdapter } from './index';

/** Web: `visibilitychange` to visible, and the `online` event. */
export function createWebLifecycle(): LifecycleAdapter {
  return {
    onResume(cb) {
      const visible = () => document.visibilityState === 'visible' && cb();
      document.addEventListener('visibilitychange', visible);
      window.addEventListener('online', cb);
      return () => {
        document.removeEventListener('visibilitychange', visible);
        window.removeEventListener('online', cb);
      };
    },
  };
}

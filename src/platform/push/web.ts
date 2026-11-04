import type { PushAdapter } from './index';

/** Web: no push; the Inbox carries every social event. */
export function createWebPush(): PushAdapter {
  return {
    available: false,
    register: async () => null,
    token: async () => null,
    onOpen: () => () => undefined,
  };
}

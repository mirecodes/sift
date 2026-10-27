import { parseDeepLink } from '../../../shared/rules/links';
import type { LinksAdapter } from './index';

/**
 * Web: the page was opened at a link path (`/join/CODE`, `/add/name-tag`, `/war/id`, or the old
 * `#/join/CODE`). The link is handed over once and the address bar goes back to the app root, so a reload
 * does not repeat it. The host serves `index.html` for these paths (docs/guides/MOBILE_SETUP.md §Deep links).
 */
export function createWebLinks(): LinksAdapter {
  let consumed = false;
  return {
    onOpen(cb) {
      if (!consumed && typeof location !== 'undefined' && parseDeepLink(location.href)) {
        consumed = true;
        const url = location.href;
        history.replaceState(null, '', import.meta.env.BASE_URL);
        queueMicrotask(() => cb(url));
      }
      return () => undefined;
    },
  };
}

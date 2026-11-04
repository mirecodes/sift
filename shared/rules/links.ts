/**
 * Deep links (guidance_v2 Step 6.5). The same paths work on the web and, through universal links / app
 * links, open the native app:
 *   group invite  /join/<CODE>       (8 letters or digits)
 *   friend add    /add/<name>-<tag>  (URL-encoded; Hangul names work; the tag is 4 digits)
 *   war replay    /war/<id>
 * The old `#/join/CODE` hash route still parses. Pure: the server builds links for push messages too.
 */
export type DeepLink =
  | { kind: 'join'; code: string }
  | { kind: 'add'; name: string; tag: string }
  | { kind: 'war'; id: string };

const CODE = /^[A-Za-z0-9]{8}$/;
const TAG = /^\d{4}$/;
const ID = /^[0-9A-Za-z_-]{1,64}$/;

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment).normalize('NFC');
  } catch {
    return null;
  }
}

/** Reads a link from a full URL or a path (`/join/AB12CD34`, `#/join/AB12CD34`). `null` if it is not one. */
export function parseDeepLink(url: string): DeepLink | null {
  let path = url.trim();
  const hash = path.indexOf('#/');
  if (hash >= 0) path = path.slice(hash + 1);
  else {
    const scheme = /^[a-z][a-z0-9+.-]*:\/\/[^/]*/i.exec(path);
    if (scheme) path = path.slice(scheme[0].length);
  }
  path = path.split(/[?#]/)[0]!;
  const parts = path.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  const [kind, raw] = parts as [string, string];
  const value = decode(raw);
  if (value === null) return null;
  switch (kind) {
    case 'join':
      return CODE.test(value) ? { kind: 'join', code: value.toUpperCase() } : null;
    case 'add': {
      const dash = value.lastIndexOf('-');
      const name = value.slice(0, dash);
      const tag = value.slice(dash + 1);
      return dash > 0 && TAG.test(tag) ? { kind: 'add', name, tag } : null;
    }
    case 'war':
      return ID.test(value) ? { kind: 'war', id: value } : null;
    default:
      return null;
  }
}

/** The shareable URL for a link, on `origin` (e.g. `https://sift.example.com`). */
export function deepLinkUrl(origin: string, link: DeepLink): string {
  const base = origin.replace(/\/+$/, '');
  switch (link.kind) {
    case 'join':
      return `${base}/join/${link.code}`;
    case 'add':
      return `${base}/add/${encodeURIComponent(`${link.name}-${link.tag}`)}`;
    case 'war':
      return `${base}/war/${encodeURIComponent(link.id)}`;
  }
}

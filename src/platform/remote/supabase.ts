import { CLIENT_HEADER, clientHeader, type ApiRequest, type ApiResponse, type Op, type Platform } from '../../../shared/api/types';
import type { SecureStorageAdapter } from '../secureStorage';
import { RemoteError, type AuthPort, type Provider, type RemotePort, type RemoteSession } from './index';

/**
 * The real backend (guidance_v2 Step 5.3): Supabase Auth over its REST API and the `api` edge function.
 * Plain `fetch`, no SDK: it works the same in a browser and inside the Capacitor app, with no cookies and
 * no same-origin redirects. Tokens live in secure storage. Setup: docs/guides/BACKEND_SETUP.md.
 */
export interface SupabaseRemoteOptions {
  url: string;
  anonKey: string;
  platform: Platform;
  appVersion: string;
  secure: SecureStorageAdapter;
  /** Where web OAuth returns (default: this page). */
  redirectTo?: string;
  fetch?: typeof fetch;
  now?: () => number;
}

interface StoredSession {
  access_token: string;
  refresh_token: string;
  /** Epoch seconds. */
  expires_at: number;
  user: { id: string; email?: string | null };
}

const KEY = 'sift.auth';

export function createSupabaseRemote(opts: SupabaseRemoteOptions): RemotePort {
  const http = opts.fetch ?? fetch.bind(globalThis);
  const now = opts.now ?? (() => Date.now());
  const base = opts.url.replace(/\/$/, '');
  let cached: StoredSession | null | undefined;
  let refreshing: Promise<StoredSession | null> | null = null;

  const toSession = (s: StoredSession): RemoteSession => ({ userId: s.user.id, email: s.user.email ?? null });

  async function load(): Promise<StoredSession | null> {
    if (cached !== undefined) return cached;
    const raw = await opts.secure.get(KEY);
    cached = raw ? (JSON.parse(raw) as StoredSession) : null;
    return cached;
  }

  async function save(s: StoredSession | null): Promise<void> {
    cached = s;
    if (s) await opts.secure.set(KEY, JSON.stringify(s));
    else await opts.secure.remove(KEY);
  }

  async function authFetch(path: string, body: unknown, token?: string): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await http(`${base}/auth/v1/${path}`, {
        method: 'POST',
        headers: { apikey: opts.anonKey, 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
        body: JSON.stringify(body),
      });
    } catch {
      throw new RemoteError('network');
    }
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 429) throw new RemoteError('rate_limited');
    if (!res.ok) throw new RemoteError(res.status >= 500 ? 'server_error' : 'unauthorized');
    return json;
  }

  const fromToken = (json: Record<string, unknown>): StoredSession => ({
    access_token: json.access_token as string,
    refresh_token: json.refresh_token as string,
    expires_at: (json.expires_at as number | undefined) ?? Math.floor(now() / 1000) + ((json.expires_in as number | undefined) ?? 3600),
    user: json.user as StoredSession['user'],
  });

  /** A valid access token, refreshed one minute before it expires. */
  async function token(): Promise<string | null> {
    const s = await load();
    if (!s) return null;
    if (s.expires_at * 1000 - now() > 60_000) return s.access_token;
    refreshing ??= authFetch('token?grant_type=refresh_token', { refresh_token: s.refresh_token })
      .then(async (json) => {
        const next = fromToken(json);
        await save(next);
        return next;
      })
      .catch(async (e) => {
        if (e instanceof RemoteError && e.code === 'unauthorized') await save(null);
        throw e;
      })
      .finally(() => (refreshing = null));
    return (await refreshing)?.access_token ?? null;
  }

  const auth: AuthPort = {
    async session() {
      const s = await load();
      return s ? toSession(s) : null;
    },
    async requestEmailCode(email) {
      await authFetch('otp', { email, create_user: true });
    },
    async verifyEmailCode(email, code) {
      const s = fromToken(await authFetch('verify', { type: 'email', email, token: code }));
      await save(s);
      return toSession(s);
    },
    async signInWithIdToken(provider: Provider, idToken: string, nonce?: string) {
      const s = fromToken(await authFetch('token?grant_type=id_token', { provider, id_token: idToken, ...(nonce && { nonce }) }));
      await save(s);
      return toSession(s);
    },
    async startOAuth(provider: Provider) {
      const redirect = opts.redirectTo ?? globalThis.location?.href.split('#')[0] ?? '';
      globalThis.location.assign(`${base}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirect)}`);
    },
    /** Web OAuth returns with the tokens in the URL fragment (implicit flow); they are stored and removed from the URL. */
    async completeRedirect() {
      const hash = globalThis.location?.hash ?? '';
      if (!hash.includes('access_token=')) return null;
      const p = new URLSearchParams(hash.slice(1));
      const accessToken = p.get('access_token')!;
      let user: StoredSession['user'];
      try {
        const res = await http(`${base}/auth/v1/user`, { headers: { apikey: opts.anonKey, authorization: `Bearer ${accessToken}` } });
        user = (await res.json()) as StoredSession['user'];
      } catch {
        throw new RemoteError('network');
      }
      const s: StoredSession = { access_token: accessToken, refresh_token: p.get('refresh_token') ?? '', expires_at: Number(p.get('expires_at')) || Math.floor(now() / 1000) + Number(p.get('expires_in') ?? 3600), user };
      await save(s);
      history.replaceState(null, '', location.pathname + location.search);
      return toSession(s);
    },
    async signOut() {
      const t = (await load())?.access_token;
      await save(null);
      if (t) await authFetch('logout', {}, t).catch(() => undefined);
    },
  };

  return {
    kind: 'supabase',
    auth,
    async send<O extends Op>(request: ApiRequest<O>): Promise<ApiResponse<O>> {
      const t = await token().catch(() => null);
      let res: Response;
      try {
        res = await http(`${base}/functions/v1/api`, {
          method: 'POST',
          headers: {
            apikey: opts.anonKey,
            authorization: `Bearer ${t ?? opts.anonKey}`,
            'content-type': 'application/json',
            [CLIENT_HEADER]: clientHeader(opts.platform, opts.appVersion),
          },
          body: JSON.stringify(request),
        });
      } catch {
        throw new RemoteError('network');
      }
      if (res.status >= 500 && res.status !== 503) throw new RemoteError('network');
      try {
        return (await res.json()) as ApiResponse<O>;
      } catch {
        throw new RemoteError('network');
      }
    },
  };
}

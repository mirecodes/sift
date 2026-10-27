import { API_VERSION, type ApiRequest, type ApiResponse, type Op } from '../../../shared/api/types';
import { handle } from '../../../server/core/api';
import type { ServerEnv } from '../../../server/core/context';
import { MemoryServerDb } from '../../../server/core/db';
import { installServerHandlers } from '../../../server/core/handlers';
import { RemoteError, type AuthPort, type Provider, type RemotePort, type RemoteSession } from './index';

/** The one-time code the fake server accepts (shown in the sign-in sheet in development). */
export const FAKE_CODE = '000000';

export interface FakeRemoteOptions {
  appVersion: string;
  /** Persists server data and the session (e.g. `localStorage`); omitted = memory only. */
  store?: { get(key: string): string | null; set(key: string, value: string): void; remove(key: string): void };
  now?: () => number;
  random?: () => number;
  uuid?: () => string;
  /** Simulated round trip in ms. */
  latencyMs?: number;
  /** A server database shared with another fake remote (two devices of two people in tests). */
  db?: MemoryServerDb;
}

export interface FakeRemote extends RemotePort {
  readonly env: ServerEnv;
  readonly db: MemoryServerDb;
  /** Simulates losing the connection: every call fails with `network`. */
  setOnline(online: boolean): void;
  /** Signs in as a given user without the code step (tests). */
  signInAs(userId: string, email?: string): Promise<RemoteSession>;
}

const SERVER_KEY = 'sift.fake.server';
const SESSION_KEY = 'sift.fake.session';

/**
 * The real server core running in the page with an in-memory database (Step 5.3): same operations,
 * idempotency and error codes as Supabase, for tests and development without a backend. Accounts are
 * fake: any email with code `000000`; Apple and Google sign in instantly.
 */
export function createFakeRemote(opts: FakeRemoteOptions): FakeRemote {
  installServerHandlers();
  const saved = opts.store?.get(SERVER_KEY);
  const db = opts.db ?? new MemoryServerDb(opts.store ? (dump) => opts.store!.set(SERVER_KEY, JSON.stringify(dump)) : undefined);
  if (saved && !opts.db) db.load(JSON.parse(saved) as Record<string, unknown[]>);
  const env: ServerEnv = {
    db,
    now: opts.now ?? (() => Date.now()),
    random: opts.random ?? (() => Math.random()),
    uuid: opts.uuid ?? (() => crypto.randomUUID()),
    hooks: {},
  };
  let online = true;
  let session: RemoteSession | null = (() => {
    const raw = opts.store?.get(SESSION_KEY);
    return raw ? (JSON.parse(raw) as RemoteSession) : null;
  })();
  const setSession = (s: RemoteSession | null) => {
    session = s;
    if (s) opts.store?.set(SESSION_KEY, JSON.stringify(s));
    else opts.store?.remove(SESSION_KEY);
    return s;
  };
  const pending = new Set<string>();
  const userFor = (email: string) => `fake-${email.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const delay = () => (opts.latencyMs ? new Promise((r) => setTimeout(r, opts.latencyMs)) : Promise.resolve());

  const auth: AuthPort = {
    async session() {
      return session;
    },
    async requestEmailCode(email) {
      await delay();
      if (!online) throw new RemoteError('network');
      pending.add(email.trim().toLowerCase());
    },
    async verifyEmailCode(email, code) {
      await delay();
      if (!online) throw new RemoteError('network');
      const key = email.trim().toLowerCase();
      if (!pending.has(key) || code.trim() !== FAKE_CODE) throw new RemoteError('unauthorized');
      pending.delete(key);
      return setSession({ userId: userFor(key), email: key })!;
    },
    async signInWithIdToken(provider: Provider) {
      return setSession({ userId: `fake-${provider}-user`, email: null })!;
    },
    async startOAuth(provider: Provider) {
      setSession({ userId: `fake-${provider}-user`, email: null });
    },
    async completeRedirect() {
      return null;
    },
    async signOut() {
      setSession(null);
    },
  };

  return {
    kind: 'fake',
    env,
    db,
    auth,
    setOnline(value) {
      online = value;
    },
    async signInAs(userId, email) {
      return setSession({ userId, email: email ?? null })!;
    },
    async send<O extends Op>(request: ApiRequest<O>): Promise<ApiResponse<O>> {
      await delay();
      if (!online) throw new RemoteError('network');
      // Round-trip through JSON like the network does, so nothing shares object identity.
      const body = JSON.parse(JSON.stringify(request)) as unknown;
      const res = await handle(env, { userId: session?.userId ?? null, platform: 'web', appVersion: opts.appVersion, apiVersion: API_VERSION }, body);
      return JSON.parse(JSON.stringify(res)) as ApiResponse<O>;
    },
  };
}

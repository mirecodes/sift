import type { ApiRequest, ApiResponse, ErrorCode, Op, OpResult, SyncDelta } from '../../../shared/api/types';

/**
 * The backend is just another platform adapter (guidance_v2 §2.1, Step 5.3). `SupabaseRemote` talks to
 * the real server over HTTPS; `FakeRemote` runs the same server core in the browser (tests, offline
 * development). Both implement this port.
 */

export interface RemoteSession {
  userId: string;
  email: string | null;
}

export type Provider = 'apple' | 'google';

export interface AuthPort {
  /** The signed-in session (refreshed when needed), or null. */
  session(): Promise<RemoteSession | null>;
  /** Emails a 6-digit one-time code (Step 5.4). */
  requestEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, code: string): Promise<RemoteSession>;
  /** Native Sign in with Apple / Google (Phase 6 plugins hand over the ID token). */
  signInWithIdToken(provider: Provider, idToken: string, nonce?: string): Promise<RemoteSession>;
  /** Web OAuth: leaves the page; `completeRedirect` reads the session back on return. */
  startOAuth(provider: Provider): Promise<void>;
  completeRedirect(): Promise<RemoteSession | null>;
  signOut(): Promise<void>;
}

export interface RemotePort {
  readonly kind: 'fake' | 'supabase';
  readonly auth: AuthPort;
  /** One API call. Resolves with the server's answer; rejects only with `RemoteError('network')`. */
  send<O extends Op>(request: ApiRequest<O>): Promise<ApiResponse<O>>;
}

/** A typed failure from the API, or `network` when no answer came back. */
export class RemoteError extends Error {
  constructor(
    readonly code: ErrorCode | 'offline',
    readonly retryAfterMs?: number,
  ) {
    super(code);
    this.name = 'RemoteError';
  }
}

export interface CallOptions {
  requestId?: string;
  sinceSeq?: number;
  /** Retries after `network` errors, with the same request id (default 2). */
  retries?: number;
  /** Waits between retries (tests pass a no-op). */
  wait?: (ms: number) => Promise<void>;
}

export interface CallResult<O extends Op> {
  data: OpResult<O>;
  delta?: SyncDelta;
  serverNow: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Calls an operation and unwraps the answer. Every retry reuses the original request id, so the server
 * answers a repeated mutation once (Step 5.3). Typed errors are thrown as `RemoteError`.
 */
export async function callApi<O extends Op>(remote: RemotePort, op: O, args: ApiRequest<O>['args'], opts: CallOptions = {}): Promise<CallResult<O>> {
  const retries = opts.retries ?? 2;
  const wait = opts.wait ?? sleep;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await remote.send({ op, args, ...(opts.requestId && { requestId: opts.requestId }), ...(opts.sinceSeq !== undefined && { sinceSeq: opts.sinceSeq }) });
      if (!res.ok) throw new RemoteError(res.error.code, res.error.retryAfterMs);
      return { data: res.data, ...(res.delta && { delta: res.delta }), serverNow: res.serverNow };
    } catch (e) {
      const network = e instanceof RemoteError && e.code === 'network';
      if (!network || attempt >= retries) throw e;
      await wait(500 * 2 ** attempt);
    }
  }
}

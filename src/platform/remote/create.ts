import type { ApiRequest, Op, Platform } from '../../../shared/api/types';
import type { SecureStorageAdapter } from '../secureStorage';
import type { AuthPort, RemotePort } from './index';

export type BackendChoice = { provider: 'none' } | { provider: 'fake' } | { provider: 'supabase'; supabaseUrl: string; supabaseAnonKey: string };

/**
 * The configured backend (`config/app.yaml` → `backend`), loaded on first use so a local-only app never
 * downloads it. `none` → null: no accounts, everything local as before.
 */
export function createRemote(backend: BackendChoice, opts: { platform: Platform; appVersion: string; secure: SecureStorageAdapter }): RemotePort | null {
  if (backend.provider === 'none') return null;
  let loading: Promise<RemotePort> | null = null;
  const load = () =>
    (loading ??=
      backend.provider === 'fake'
        ? import('./fake').then(({ createFakeRemote }) => {
            const ls = globalThis.localStorage;
            const fake = createFakeRemote({
              appVersion: opts.appVersion,
              latencyMs: 150,
              store: ls && { get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v), remove: (k) => ls.removeItem(k) },
            });
            // Development and tests: `__siftFake.setOnline(false)` simulates a lost connection.
            (globalThis as { __siftFake?: unknown }).__siftFake = fake;
            return fake;
          })
        : import('./supabase').then(({ createSupabaseRemote }) =>
            createSupabaseRemote({ url: backend.supabaseUrl, anonKey: backend.supabaseAnonKey, platform: opts.platform, appVersion: opts.appVersion, secure: opts.secure }),
          ));
  const auth: AuthPort = {
    session: async () => (await load()).auth.session(),
    requestEmailCode: async (email) => (await load()).auth.requestEmailCode(email),
    verifyEmailCode: async (email, code) => (await load()).auth.verifyEmailCode(email, code),
    signInWithIdToken: async (provider, token, nonce) => (await load()).auth.signInWithIdToken(provider, token, nonce),
    startOAuth: async (provider) => (await load()).auth.startOAuth(provider),
    completeRedirect: async () => (await load()).auth.completeRedirect(),
    signOut: async () => (await load()).auth.signOut(),
  };
  return {
    kind: backend.provider,
    auth,
    send: async <O extends Op>(request: ApiRequest<O>) => (await load()).send(request),
  };
}

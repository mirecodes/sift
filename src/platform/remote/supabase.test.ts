import { describe, expect, it } from 'vitest';
import { createWebSecureStorage } from '../secureStorage/web';
import { callApi, RemoteError } from './index';
import { createSupabaseRemote } from './supabase';

type Call = { url: string; init: RequestInit };

function mockFetch(routes: Record<string, (body: unknown, init: RequestInit) => { status?: number; json: unknown } | 'throw'>) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const path = url.replace('https://x.supabase.co', '');
    const route = Object.entries(routes).find(([p]) => path.startsWith(p));
    if (!route) throw new Error(`no route ${path}`);
    const out = route[1](init.body ? JSON.parse(init.body as string) : undefined, init);
    if (out === 'throw') throw new TypeError('Failed to fetch');
    return new Response(JSON.stringify(out.json), { status: out.status ?? 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const make = (f: typeof fetch, now = () => 1_000_000_000) =>
  createSupabaseRemote({ url: 'https://x.supabase.co/', anonKey: 'anon', platform: 'web', appVersion: '0.2.0', secure: createWebSecureStorage(), fetch: f, now });

const token = (n: number, expiresAt: number) => ({ access_token: `at${n}`, refresh_token: `rt${n}`, expires_at: expiresAt, user: { id: 'user-1', email: 'mina@example.com' } });

describe('SupabaseRemote (Step 5.3)', () => {
  it('signs in with an email code and calls the API with the token and client header', async () => {
    const { f, calls } = mockFetch({
      '/auth/v1/otp': () => ({ json: {} }),
      '/auth/v1/verify': (b) => ((b as { token: string }).token === '123456' ? { json: token(1, 1_000_000 + 3600) } : { status: 400, json: {} }),
      '/functions/v1/api': () => ({ json: { ok: true, data: { manifest: null }, serverNow: 5 } }),
    });
    const r = make(f);
    await r.auth.requestEmailCode('mina@example.com');
    await expect(r.auth.verifyEmailCode('mina@example.com', '000000')).rejects.toMatchObject({ code: 'unauthorized' });
    expect(await r.auth.verifyEmailCode('mina@example.com', '123456')).toEqual({ userId: 'user-1', email: 'mina@example.com' });
    const res = await callApi(r, 'get_content_manifest', { clientVersion: '0.2.0' });
    expect(res).toEqual({ data: { manifest: null }, serverNow: 5 });
    const api = calls.at(-1)!;
    const headers = api.init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer at1');
    expect(headers.apikey).toBe('anon');
    expect(headers['x-sift-client']).toBe('web/0.2.0/1');
    expect(JSON.parse(api.init.body as string)).toEqual({ op: 'get_content_manifest', args: { clientVersion: '0.2.0' } });
  });

  it('refreshes an expiring token once, and signs out when the refresh is refused', async () => {
    let clock = 1_000_000_000;
    const { f, calls } = mockFetch({
      '/auth/v1/verify': () => ({ json: token(1, 1_000_000 + 30) }),
      '/auth/v1/token?grant_type=refresh_token': () => ({ json: token(2, 1_000_000 + 7200) }),
      '/functions/v1/api': () => ({ json: { ok: true, data: {}, serverNow: 1 } }),
    });
    const r = make(f, () => clock);
    await r.auth.verifyEmailCode('a@b.c', '1');
    await Promise.all([callApi(r, 'sync_pull', {}), callApi(r, 'sync_pull', {})]);
    expect(calls.filter((c) => c.url.includes('refresh_token'))).toHaveLength(1);
    expect((calls.at(-1)!.init.headers as Record<string, string>).authorization).toBe('Bearer at2');

    const refused = mockFetch({
      '/auth/v1/verify': () => ({ json: token(1, 1_000_000 + 30) }),
      '/auth/v1/token': () => ({ status: 400, json: {} }),
      '/functions/v1/api': () => ({ json: { ok: false, error: { code: 'unauthorized' }, serverNow: 1 } }),
    });
    const r2 = make(refused.f, () => clock);
    await r2.auth.verifyEmailCode('a@b.c', '1');
    clock += 10_000;
    await expect(callApi(r2, 'me', {})).rejects.toMatchObject({ code: 'unauthorized' });
    expect(await r2.auth.session()).toBeNull();
  });

  it('turns transport failures into retried network errors with the same request id', async () => {
    let n = 0;
    const { f, calls } = mockFetch({ '/functions/v1/api': () => (++n < 3 ? 'throw' : { json: { ok: true, data: {}, serverNow: 1 } }) });
    const r = make(f);
    await callApi(r, 'sync_push', { ops: [] }, { requestId: 'req-1', wait: async () => undefined });
    expect(calls.map((c) => JSON.parse(c.init.body as string).requestId)).toEqual(['req-1', 'req-1', 'req-1']);
    const down = mockFetch({ '/functions/v1/api': () => 'throw' });
    await expect(callApi(make(down.f), 'me', {}, { wait: async () => undefined })).rejects.toBeInstanceOf(RemoteError);
  });
});

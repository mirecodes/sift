// Sift API edge function (Deno, Supabase). Thin host around the bundled server core (`sift.js`, built by
// `npm run server:build`): verifies the caller's token, reads the client header, runs the operation in one
// Postgres transaction, and answers JSON. Setup: docs/guides/BACKEND_SETUP.md. Not type-checked by `tsc`
// (Deno globals and `npm:` imports); verified with `npm run server:check` and on a Supabase project.
import postgres from 'npm:postgres@3.4.5';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';
import { createApi, parseClientHeader } from './sift.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
/** Shared secret for scheduled jobs (pg_cron → POST /api/job/hourly). Set with `supabase secrets set SIFT_JOB_SECRET=…`. */
const JOB_SECRET = Deno.env.get('SIFT_JOB_SECRET');
/** Legacy HS256 projects only; new projects sign tokens with asymmetric keys (JWKS). */
const JWT_SECRET = Deno.env.get('SIFT_JWT_SECRET');

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 3 });

const api = createApi({
  client: {
    transaction: (fn) => sql.begin((tx) => fn(async (text: string, params?: unknown[]) => ({ rows: await tx.unsafe(text, params as never[]) }))),
  },
  hooks: {
    async deleteAuthUser(userId: string) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    },
    async push(userId, message) {
      // Phase 6: Firebase Cloud Messaging HTTP v1 (docs/guides/MOBILE_SETUP.md). Disabled until configured.
      const { sendPush } = await import('./push.ts');
      await sendPush(sql, userId, message);
    },
  },
});

// Newest published content pack (Step 5.8): purchases are checked against the same catalog clients see.
try {
  const [row] = await sql`select data from public.content_releases order by (data->>'publishedAt')::bigint desc limit 1`.catch(() => []);
  const release = row?.data as { packUrl: string; checksum: string } | undefined;
  if (release) {
    const text = await (await fetch(release.packUrl)).text();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map((b) => b.toString(16).padStart(2, '0')).join('');
    if (digest === release.checksum) api.mergeContent(JSON.parse(text));
  }
} catch (e) {
  console.error('content pack not loaded', e);
}

const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

/** The user id of a valid access token, or null (anonymous key, expired, forged). */
async function userOf(req: Request): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const { payload } = JWT_SECRET ? await jwtVerify(token, new TextEncoder().encode(JWT_SECRET)) : await jwtVerify(token, JWKS);
    return payload.role === 'authenticated' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-sift-client',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: { code: 'invalid' }, serverNow: Date.now() }, 405);
  const path = new URL(req.url).pathname;
  if (path.endsWith('/job/hourly')) {
    if (!JOB_SECRET || req.headers.get('x-sift-job') !== JOB_SECRET) return json({ ok: false }, 403);
    return json({ ok: true, data: await api.hourly() });
  }
  if (path.endsWith('/job/weekly')) {
    if (!JOB_SECRET || req.headers.get('x-sift-job') !== JOB_SECRET) return json({ ok: false }, 403);
    return json({ ok: true, data: await api.weekly?.() });
  }
  const client = parseClientHeader(req.headers.get('x-sift-client'));
  if (!client) return json({ ok: false, error: { code: 'client_outdated' }, serverNow: Date.now() });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: { code: 'invalid' }, serverNow: Date.now() });
  }
  return json(await api.handle({ userId: await userOf(req), ...client }, body));
});

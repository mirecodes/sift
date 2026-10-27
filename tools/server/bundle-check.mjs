// npm run server:check: loads the built edge bundle (server/supabase/functions/api/sift.js) in Node with
// an in-process Postgres (PGlite) and the committed migrations, and runs a focus session through it: the
// same path the Deno edge function takes, minus HTTP and auth.
import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const { createApi } = await import(new URL('../../server/supabase/functions/api/sift.js', import.meta.url).href);
const pg = new PGlite();
const dir = new URL('../../server/supabase/migrations/', import.meta.url);
for (const f of readdirSync(dir).sort()) await pg.exec(readFileSync(new URL(f, dir), 'utf8'));
const api = createApi({ client: { transaction: (fn) => pg.transaction((tx) => fn(async (text, params) => ({ rows: (await tx.query(text, params)).rows }))) } });
const caller = { userId: 'check-user', platform: 'web', appVersion: '0.2.0', apiVersion: 1 };
const start = await api.handle(caller, { op: 'start_session', args: { plannedMs: 25 * 60_000 }, requestId: 'c1' });
const end = await api.handle(caller, { op: 'end_session', args: { sessionId: start.data.session.id, endedAt: Date.now(), status: 'abandoned' }, requestId: 'c2', sinceSeq: 0 });
const ok = start.ok && end.ok && end.data.session.status === 'abandoned' && end.delta.rows.ledger.length === 1;
console.log(ok ? 'bundle ok: start_session, end_session and delta sync work on Postgres' : `bundle FAILED: ${JSON.stringify({ start, end })}`);
process.exit(ok ? 0 : 1);

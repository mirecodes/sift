import { buildPack, type ContentPack } from '../../shared/content/pack';
import type { Caller, ServerHooks } from '../core/context';
import { handle, runHourlyJob } from '../core/api';
import { createPgServerDb, type SqlClient } from '../pg/pgDb';
import { content } from '../../src/domain/content';
import { installServerHandlers } from '../core/handlers';

/** Uniform [0, 1) from the platform's cryptographic generator (rewards, war seeds). */
const cryptoRandom = (): number => (crypto.getRandomValues(new Uint32Array(1))[0] as number) / 2 ** 32;

/**
 * Entry of the bundled server core (`npm run server:build` → `server/supabase/functions/api/sift.js`).
 * The Deno edge function (`index.ts` there) gives it a Postgres client and host hooks; everything else
 * is the same code the tests and the fake remote run.
 */
export function createApi(opts: { client: SqlClient; hooks?: ServerHooks }) {
  installServerHandlers();
  const env = { db: createPgServerDb(opts.client), now: () => Date.now(), random: cryptoRandom, uuid: () => crypto.randomUUID(), hooks: opts.hooks ?? {} };
  return {
    handle: (caller: Caller, body: unknown) => handle(env, caller, body),
    hourly: () => runHourlyJob(env),
    /** Merges a published content pack (Step 5.8) so purchases are checked against the newest catalog. */
    mergeContent(pack: ContentPack) {
      content.merge(pack);
    },
  };
}

export { buildPack };
export { parseClientHeader } from '../../shared/api/types';

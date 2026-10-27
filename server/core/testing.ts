import type { ApiResponse, Op, OpArgs, OpResult } from '../../shared/api/types';
import { API_VERSION } from '../../shared/api/types';
import { seededRng } from '../../shared/rng';
import { handle } from './api';
import type { ServerEnv } from './context';
import { MemoryServerDb, type ServerDb } from './db';
import { installServerHandlers } from './handlers';

/** A server with a controllable clock and seeded randomness (unit tests, the fake remote's bots). */
export function testServer(opts: { db?: ServerDb; start?: number; seed?: number } = {}) {
  installServerHandlers();
  const clock = { t: opts.start ?? Date.UTC(2026, 9, 27, 10) };
  let n = 0;
  const env: ServerEnv = {
    db: opts.db ?? new MemoryServerDb(),
    now: () => clock.t,
    random: seededRng(opts.seed ?? 7),
    uuid: () => `u${String(++n).padStart(6, '0')}`,
    hooks: {},
  };
  let req = 0;
  /** Calls an operation as `userId` (null = signed out); mutations get a fresh request id unless given. */
  async function call<O extends Op>(userId: string | null, op: O, args: OpArgs<O>, extra: { requestId?: string; sinceSeq?: number; apiVersion?: number } = {}): Promise<ApiResponse<O>> {
    return (await handle(env, { userId, platform: 'web', appVersion: '0.2.0', apiVersion: extra.apiVersion ?? API_VERSION }, { op, args, requestId: extra.requestId ?? `r${++req}`, sinceSeq: extra.sinceSeq })) as ApiResponse<O>;
  }
  /** Like `call`, but returns the data and throws on an error code. */
  async function ok<O extends Op>(userId: string | null, op: O, args: OpArgs<O>, extra?: Parameters<typeof call>[3]): Promise<OpResult<O>> {
    const r = await call(userId, op, args, extra);
    if (!r.ok) throw new Error(`${op}: ${r.error.code}`);
    return r.data;
  }
  return { env, clock, call, ok };
}

export const MIN = 60_000;

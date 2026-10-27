import { API_VERSION, MUTATIONS, PUBLIC_OPS, type ApiResponse, type Op, type SyncDelta } from '../../shared/api/types';
import { ARGS } from './args';
import { ApiError, UserWriter, type Caller, type HandlerCtx, type ServerEnv } from './context';
import { DuplicateKeyError, type Tx } from './db';
import { coreHandlers, type Handlers } from './handlers/core';
import { ensureProfile, pull, settleExpirations } from './user';

/** Server-only settings (`app_config` table, §8): version gate and rate limits. */
export interface AppConfig {
  minSupportedApiVersion: number;
  /** Calls per user per minute, by operation (`default` for the rest). */
  rateLimits: Record<string, number>;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  minSupportedApiVersion: API_VERSION,
  rateLimits: { default: 120, purchase: 30, upload_local_save: 5, declare_war: 6, join_group_by_code: 10, friend_request: 20, report_user: 10, set_handle: 10 },
};

/** Results of mutations are kept this long for retries (Step 5.2). */
export const IDEMPOTENCY_MS = 48 * 3_600_000;

/** Calls that settle expirations first, so gold and animals are current (Step 5.5). */
const SETTLES: ReadonlySet<Op> = new Set<Op>(['start_session', 'end_session', 'sync_pull', 'purchase', 'apply_layout', 'move_island', 'export_account']);

const handlers: Handlers = { ...coreHandlers };

/** Later phases register their operations here (social, groups, war). */
export function registerHandlers(more: Handlers): void {
  Object.assign(handlers, more);
}

const configCache = new WeakMap<ServerEnv, { at: number; value: AppConfig }>();

async function appConfig(env: ServerEnv): Promise<AppConfig> {
  const cached = configCache.get(env);
  if (cached && env.now() - cached.at < 60_000) return cached.value;
  const row = await env.db.transaction((tx) => tx.table('app_config').get('client'));
  const value = { ...DEFAULT_APP_CONFIG, ...(row?.value as Partial<AppConfig> | undefined) };
  configCache.set(env, { at: env.now(), value });
  return value;
}

/** Drops cached settings (tests, after editing `app_config`). */
export const clearConfigCache = (env: ServerEnv) => configCache.delete(env);

const fail = (env: ServerEnv, e: unknown): ApiResponse => {
  if (e instanceof ApiError) return { ok: false, error: { code: e.code, ...(e.retryAfterMs !== undefined && { retryAfterMs: e.retryAfterMs }) }, serverNow: env.now() };
  if (e instanceof DuplicateKeyError) return { ok: false, error: { code: 'invalid' }, serverNow: env.now() };
  console.error('sift api: unexpected error', e);
  return { ok: false, error: { code: 'server_error' }, serverNow: env.now() };
};

async function rateLimit(env: ServerEnv, cfg: AppConfig, userId: string, op: Op): Promise<void> {
  const limit = cfg.rateLimits[op] ?? cfg.rateLimits.default ?? Infinity;
  const minute = Math.floor(env.now() / 60_000);
  const key = `${userId}:${op}:${minute}`;
  await env.db.transaction(async (tx) => {
    const row = await tx.table('rate_counters').get(key);
    const count = (row?.count ?? 0) + 1;
    if (count > limit) throw new ApiError('rate_limited', (minute + 1) * 60_000 - env.now());
    await tx.table('rate_counters').put({ key, count, minute });
  });
}

/**
 * Handles one API call (Step 5.2): version gate, auth, argument check, rate limit, idempotency, then the
 * operation in one transaction with the caller's expirations settled first. Every answer carries
 * `serverNow`; with `sinceSeq` it also carries the rows changed since (delta sync).
 */
export async function handle(env: ServerEnv, caller: Caller, request: unknown): Promise<ApiResponse> {
  try {
    const cfg = await appConfig(env);
    if (caller.apiVersion < cfg.minSupportedApiVersion) throw new ApiError('client_outdated');
    const req = request as { op?: unknown; args?: unknown; requestId?: unknown; sinceSeq?: unknown };
    const op = req.op as Op;
    if (typeof op !== 'string' || !(op in ARGS) || !handlers[op]) throw new ApiError('invalid');
    const parsed = ARGS[op].safeParse(req.args ?? {});
    if (!parsed.success) throw new ApiError('invalid');
    const requestId = typeof req.requestId === 'string' && req.requestId.length <= 80 ? req.requestId : undefined;
    const sinceSeq = typeof req.sinceSeq === 'number' && Number.isInteger(req.sinceSeq) && req.sinceSeq >= 0 ? req.sinceSeq : undefined;
    const mutation = MUTATIONS.has(op);
    if (mutation && !requestId) throw new ApiError('invalid');

    const userId = caller.userId;
    if (!userId) {
      if (!PUBLIC_OPS.has(op)) throw new ApiError('unauthorized');
      const data = await env.db.transaction((tx) => run(env, caller, tx, '', op, parsed.data, false));
      return { ok: true, data, serverNow: env.now() } as ApiResponse;
    }

    await rateLimit(env, cfg, userId, op);
    const out = await env.db.transaction(async (tx) => {
      await tx.lockUser(userId);
      await ensureProfile(tx, userId, env.now());
      const key = `${userId}:${requestId}`;
      if (mutation) {
        const done = await tx.table('api_requests').get(key);
        if (done) return { data: done.result, delta: sinceSeq !== undefined ? await pull(tx, userId, sinceSeq) : undefined };
      }
      const data = await run(env, caller, tx, userId, op, parsed.data, SETTLES.has(op));
      if (mutation) await tx.table('api_requests').put({ key, userId, op, result: data, createdAt: env.now() });
      let delta: SyncDelta | undefined;
      if (sinceSeq !== undefined && op !== 'delete_account') delta = await pull(tx, userId, sinceSeq);
      return { data, delta };
    });
    if (op === 'delete_account') await env.hooks?.deleteAuthUser?.(userId);
    return { ok: true, data: out.data, ...(out.delta && { delta: out.delta }), serverNow: env.now() } as ApiResponse;
  } catch (e) {
    return fail(env, e);
  }
}

async function run(env: ServerEnv, caller: Caller, tx: Tx, userId: string, op: Op, args: unknown, settle: boolean) {
  const writers = new Map<string, UserWriter>();
  const writerFor = async (id: string) => {
    let w = writers.get(id);
    if (!w) {
      await tx.lockUser(id);
      await ensureProfile(tx, id, env.now());
      w = new UserWriter(tx, id);
      writers.set(id, w);
    }
    return w;
  };
  const w = userId ? await writerFor(userId) : (null as unknown as UserWriter);
  const ctx: HandlerCtx = { env, tx, caller, userId, w, now: env.now(), writerFor };
  if (settle) await settleExpirations(ctx, w);
  const data = await (handlers[op] as (c: HandlerCtx, a: unknown) => Promise<unknown>)(ctx, args);
  if (op !== 'delete_account') for (const writer of writers.values()) await writer.finish();
  return data;
}

/**
 * Scheduled maintenance (`job_hourly`, Step 5.5): settles every user's expirations and drops stale
 * idempotency results and rate counters. Run by `pg_cron` through the edge function with the service key.
 */
export async function runHourlyJob(env: ServerEnv): Promise<{ users: number }> {
  const now = env.now();
  const users = await env.db.transaction(async (tx) => (await tx.table('profiles').find({})).map((p) => p.userId));
  for (const userId of users) {
    await env.db.transaction(async (tx) => {
      await tx.lockUser(userId);
      const w = new UserWriter(tx, userId);
      await settleExpirations({ tx, now, env }, w);
      await w.finish();
    });
  }
  await env.db.transaction(async (tx) => {
    for (const r of await tx.table('api_requests').find({})) if (r.createdAt < now - IDEMPOTENCY_MS) await tx.table('api_requests').delete(r.key);
    for (const r of await tx.table('rate_counters').find({})) if (r.minute < Math.floor(now / 60_000) - 60) await tx.table('rate_counters').delete(r.key);
  });
  return { users: users.length };
}

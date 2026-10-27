import type { Op, OpArgs, OpResult, PushOp, SyncDelta } from '../../shared/api/types';
import { SCHEMA_VERSION } from '../db/migrations';
import type { FocusSession, LedgerEntry, PlacedAnimal } from '../domain/types';
import type { AwaitingReward, StoredPhase } from '../domain/timer/phase';
import { callApi, RemoteError, type Provider, type RemotePort } from '../platform/remote';
import type { AccountLink, Commit, StorageAdapter } from '../platform/storage';
import { applyDelta, backupFromRows, localSaveOf, type SyncedState } from './sync';

/** Sign-in state shown in the UI (Step 5.4). */
export interface AccountState {
  /** off: no backend configured · signedOut · signedIn · expired: the server no longer accepts the session. */
  status: 'off' | 'signedOut' | 'signedIn' | 'expired';
  userId: string | null;
  email: string | null;
  /** The last call reached the server. */
  online: boolean;
  /** First sign-in on an account that already has data: the user picks which data to keep (Step 5.7). */
  choice: { userId: string; email: string | null } | null;
  /** The server refuses this app version (`client_outdated`): a blocking "Please update" screen. */
  outdated: boolean;
}

export type AccountChoice = 'useAccount' | 'replaceAccount';

/** What the account layer needs from the store (kept narrow so the store file stays readable). */
export interface AccountCtx {
  remote: RemotePort | null;
  storage: () => StorageAdapter;
  now: () => number;
  uuid: () => string;
  commit: (c: Commit) => Promise<void>;
  /** The synced part of the store state, and a setter for it plus extra fields. */
  synced: () => SyncedState & { phase: StoredPhase; account: AccountState };
  set: (patch: Record<string, unknown>) => void;
  /** Ids of rows that exist only in memory (dummy data, test mode). */
  memoryOnly: ReadonlySet<string>;
  /** Reloads the store from storage after the stores were replaced. */
  reload: () => Promise<void>;
  /** Puts the reward into the running break once the server answers (or applies it quietly). */
  onReward: (pending: AwaitingReward, animal: PlacedAnimal | null) => Promise<void>;
}

export const SIGNED_OUT: AccountState = { status: 'signedOut', userId: null, email: null, online: true, choice: null, outdated: false };
export const ACCOUNT_OFF: AccountState = { ...SIGNED_OUT, status: 'off' };

/** How often the idle app pulls (Step 5.6). */
export const SYNC_EVERY_MS = 5 * 60_000;

/**
 * Accounts and sync for the store (Steps 5.4–5.7): the account link, the outbox, delta pulls, the
 * server-authoritative calls, and the first-sign-in migration. Signed out (or with no backend) nothing
 * here runs and the app is local-only as before.
 */
export function createAccount(ctx: AccountCtx) {
  let link: AccountLink | null = null;
  const ledgerIds = new Set<string>();
  const dismissed = new Set<string>();
  let lastSync = 0;
  let syncing: Promise<void> | null = null;

  const account = () => ctx.synced().account;
  const setAccount = (patch: Partial<AccountState>) => ctx.set({ account: { ...account(), ...patch } });

  async function saveLink(next: AccountLink | null) {
    link = next;
    await ctx.commit({ account: next });
  }

  /** Applies a server delta to storage and the store. */
  async function apply(delta: SyncDelta | undefined) {
    if (!delta || !link) return;
    const state = ctx.synced();
    const out = applyDelta(state, delta, { ledger: ledgerIds, dismissed }, link);
    for (const id of out.ledgerIds) ledgerIds.add(id);
    link = out.link;
    await ctx.commit(out.commit);
    ctx.set({ ...out.next, ...(out.championWeek !== undefined && { championWeek: out.championWeek }) });
  }

  /** One call with the sync cursor; applies the delta; tracks online/outdated/expired. */
  async function call<O extends Op>(op: O, args: OpArgs<O>, opts: { requestId?: string } = {}): Promise<OpResult<O>> {
    if (!ctx.remote) throw new RemoteError('offline');
    try {
      const res = await callApi(ctx.remote, op, args, { ...opts, ...(link && { sinceSeq: link.seq }) });
      if (!account().online) setAccount({ online: true });
      await apply(res.delta);
      return res.data;
    } catch (e) {
      if (e instanceof RemoteError) {
        if (e.code === 'network') setAccount({ online: false });
        if (e.code === 'client_outdated') setAccount({ outdated: true });
        if (e.code === 'unauthorized' && link) setAccount({ status: 'expired' });
      }
      throw e;
    }
  }

  /** Sends queued outbox items in order, each with its own stable request id; stops at the first failure. */
  async function flush() {
    while (link?.outbox.length) {
      const [item] = link.outbox;
      try {
        await call('sync_push', { ops: [item!.op] }, { requestId: item!.requestId });
      } catch (e) {
        // A rejected item (invalid) is dropped; anything else waits for the next sync.
        if (!(e instanceof RemoteError) || e.code !== 'invalid') return;
      }
      if (link) await saveLink({ ...link, outbox: link.outbox.slice(1) });
    }
  }

  async function retryRewards() {
    for (const p of [...(link?.pendingEnds ?? [])]) {
      try {
        const out = await call('end_session', { sessionId: p.sessionId, endedAt: p.endedAt, status: 'completed' }, { requestId: p.requestId });
        if (link) await saveLink({ ...link, pendingEnds: link.pendingEnds.filter((x) => x.requestId !== p.requestId) });
        await ctx.onReward(p, out.animal);
      } catch {
        return;
      }
    }
  }

  return {
    get linked() {
      return link !== null;
    },
    get link() {
      return link;
    },

    /** From storage at startup: the link, known ledger ids. */
    restore(saved: AccountLink | undefined, ledger: readonly LedgerEntry[]) {
      link = saved ? { ...saved, outbox: saved.outbox ?? [], pendingEnds: saved.pendingEnds ?? [] } : null;
      ledgerIds.clear();
      for (const e of ledger) ledgerIds.add(e.id);
      if (!ctx.remote) return ACCOUNT_OFF;
      return link ? { ...SIGNED_OUT, status: 'signedIn' as const, userId: link.userId, email: link.email } : SIGNED_OUT;
    },

    call,
    apply,

    /** Queues a non-economic change and tries to send it (Step 5.6). Later equip changes replace earlier ones. */
    async queue(op: PushOp) {
      if (!link) return;
      if (op.kind === 'dismiss_notice') dismissed.add(op.id);
      const outbox = op.kind === 'equip' ? link.outbox.filter((x) => x.op.kind !== 'equip') : link.outbox;
      await saveLink({ ...link, outbox: [...outbox, { requestId: ctx.uuid(), op }] });
      void flush().catch(() => undefined);
    },

    /**
     * Pull (Step 5.6): outbox first, then rewards waiting for an answer, then rows changed since the cursor.
     * Never during Focus. `force` skips the 5-minute spacing.
     */
    sync(force = false): Promise<void> {
      if (!link || !ctx.remote || ctx.synced().phase.kind === 'focus') return Promise.resolve();
      if (!force && ctx.now() - lastSync < SYNC_EVERY_MS) return Promise.resolve();
      syncing ??= (async () => {
        lastSync = ctx.now();
        await flush();
        await retryRewards();
        await call('sync_pull', {}).catch(() => undefined);
      })().finally(() => (syncing = null));
      return syncing;
    },

    /** A focus started signed in: confirmed by the server in the background, or it stays unverified. */
    async confirmStart(session: FocusSession): Promise<boolean> {
      if (!link) return false;
      try {
        await call('start_session', { sessionId: session.id, plannedMs: session.plannedFocusMs }, { requestId: `start-${session.id}` });
        return true;
      } catch {
        return false;
      }
    },

    /** End of a verified session: asks the server for the reward; offline, it waits in `pendingEnds`. */
    async endVerified(pending: AwaitingReward): Promise<{ animal: PlacedAnimal | null } | 'waiting'> {
      if (!link) return 'waiting';
      await saveLink({ ...link, pendingEnds: [...link.pendingEnds, pending] });
      try {
        const out = await call('end_session', { sessionId: pending.sessionId, endedAt: pending.endedAt, status: 'completed' }, { requestId: pending.requestId });
        if (link) await saveLink({ ...link, pendingEnds: link.pendingEnds.filter((x) => x.requestId !== pending.requestId) });
        return { animal: out.animal };
      } catch {
        return 'waiting';
      }
    },

    /** Best effort: a stopped verified session; the server also abandons stale ones itself. */
    async abandonVerified(sessionId: string, endedAt: number) {
      await call('end_session', { sessionId, endedAt, status: 'abandoned' }, { requestId: `abandon-${sessionId}` }).catch(() => undefined);
    },

    // --- Sign-in (Steps 5.4, 5.7) ---

    async requestCode(email: string) {
      if (!ctx.remote) throw new RemoteError('offline');
      await ctx.remote.auth.requestEmailCode(email);
    },

    async verifyCode(email: string, code: string) {
      if (!ctx.remote) throw new RemoteError('offline');
      const session = await ctx.remote.auth.verifyEmailCode(email, code);
      await this.linkAccount(session.userId, session.email);
    },

    async signInWithProvider(provider: Provider) {
      if (!ctx.remote) throw new RemoteError('offline');
      await ctx.remote.auth.startOAuth(provider);
      const session = await ctx.remote.auth.session();
      if (session) await this.linkAccount(session.userId, session.email);
    },

    /** After a web OAuth redirect: links the account that came back, if any. */
    async completeRedirect() {
      const session = await ctx.remote?.auth.completeRedirect().catch(() => null);
      if (session) await this.linkAccount(session.userId, session.email);
    },

    /**
     * Links this device to a signed-in account (Step 5.7). Same account again: just re-enable sync. An
     * empty account takes this device's save; one with data asks the user (`choice`).
     */
    async linkAccount(userId: string, email: string | null) {
      if (link?.userId === userId) {
        setAccount({ status: 'signedIn', userId, email, choice: null });
        await this.sync(true);
        return;
      }
      const { hasData } = await callApi(ctx.remote!, 'me', {}).then((r) => r.data);
      if (hasData) {
        setAccount({ choice: { userId, email } });
        return;
      }
      await callApi(ctx.remote!, 'upload_local_save', { save: localSaveOf(ctx.synced(), await localLedger(), ctx.memoryOnly), replace: false }, { requestId: ctx.uuid() });
      await this.replaceLocalWithAccount(userId, email);
    },

    /** The user's answer when both the device and the account have data (Step 5.7). */
    async resolveChoice(answer: AccountChoice) {
      const pending = account().choice;
      if (!pending) return;
      if (answer === 'replaceAccount') {
        await callApi(ctx.remote!, 'upload_local_save', { save: localSaveOf(ctx.synced(), await localLedger(), ctx.memoryOnly), replace: true }, { requestId: ctx.uuid() });
      }
      await this.replaceLocalWithAccount(pending.userId, pending.email);
    },

    async cancelChoice() {
      setAccount({ choice: null });
      await ctx.remote?.auth.signOut();
    },

    /** Replaces the local stores with the account's rows (full pull) and links the device. */
    async replaceLocalWithAccount(userId: string, email: string | null) {
      const res = await callApi(ctx.remote!, 'sync_pull', {}, { sinceSeq: 0 });
      const next: AccountLink = { userId, email, seq: res.delta?.seq ?? 0, outbox: [], pendingEnds: [] };
      const current = await ctx.storage().exportAll();
      const data = backupFromRows(res.delta!.rows, { kv: current.kv ?? [], contentPacks: current.contentPacks ?? [] }, next);
      await ctx.storage().importAll(data, SCHEMA_VERSION);
      link = next;
      await ctx.reload();
      setAccount({ status: 'signedIn', userId, email, choice: null, online: true });
    },

    /**
     * Signs out and clears this device's copy of the account (ADR-047): the next start is a fresh local
     * save, so account data cannot be carried into another account. The UI offers an export first.
     */
    async signOut() {
      await ctx.remote?.auth.signOut();
      link = null;
      await ctx.storage().importAll({ kv: (await ctx.storage().exportAll()).kv?.filter((r) => (r as { key: string }).key === 'settings') ?? [] }, SCHEMA_VERSION);
      await ctx.reload();
      setAccount({ ...SIGNED_OUT });
    },

    /**
     * Registers this device for push (Step 6.6): its token, app version, locale and category choices.
     * The device id is made once per sign-in and kept with the account link.
     */
    async registerDevice(device: Omit<OpArgs<'register_device'>, 'deviceId'>) {
      if (!link) return;
      if (!link.deviceId) await saveLink({ ...link, deviceId: ctx.uuid() });
      await call('register_device', { deviceId: link.deviceId!, ...device }, { requestId: ctx.uuid() });
    },

    /** In-app account deletion (Step 5.4): server data first, then the local copy. */
    async deleteAccount() {
      await call('delete_account', {}, { requestId: ctx.uuid() });
      await this.signOut();
    },
  };

  async function localLedger(): Promise<LedgerEntry[]> {
    return (await ctx.storage().load()).ledger;
  }
}

export type Account = ReturnType<typeof createAccount>;

import type { ErrorCode, IslandSnapshot, Op, OpArgs, OpResult, ReportReason, RoomView, SocialState } from '../../shared/api/types';
import { balance } from '../../shared/balance/balance';
import { parseHandle } from '../../shared/rules/handle';
import { RemoteError } from '../platform/remote';
import type { Account } from './account';

/** Social data in the store (Phase 7). Server data only: nothing here is saved on the device. */
export interface SocialSlice {
  /** The Friends tab's data; null until loaded (or signed out). */
  social: SocialState | null;
  /** idle: not loaded · loading · ready · offline: the last load failed. */
  socialStatus: 'idle' | 'loading' | 'ready' | 'offline';
  /** The island being visited (Step 7.4); the scene shows it instead of the user's own. */
  visit: IslandSnapshot | null;
  /** The focus-together room the user is in (Step 7.7), from the lobby to the shared break. */
  room: RoomView | null;
}

export const SOCIAL_EMPTY: SocialSlice = { social: null, socialStatus: 'idle', visit: null, room: null };

/** What the social layer needs from the store. */
export interface SocialCtx {
  account: Account;
  now: () => number;
  uuid: () => string;
  get: () => SocialSlice & { account: { status: string } };
  set: (patch: Partial<SocialSlice>) => void;
  /** The first social action may show the push explanation (Step 6.6). */
  askPush: () => void;
}

/** An action's outcome for the screen: null, or the error code to show (`offline`: no backend). */
export type Outcome = ErrorCode | 'offline' | null;

const codeOf = (e: unknown): ErrorCode | 'offline' => (e instanceof RemoteError ? e.code : 'server_error');

export function createSocial(ctx: SocialCtx) {
  const snapshots = new Map<string, { at: number; snapshot: IslandSnapshot }>();

  async function run<O extends Op>(op: O, args: OpArgs<O>, opts: { mutation?: boolean } = {}): Promise<OpResult<O>> {
    return ctx.account.call(op, args, opts.mutation === false ? {} : { requestId: ctx.uuid() });
  }

  /** Calls a mutation and reloads the lists; returns the error code instead of throwing. */
  async function act<O extends Op>(op: O, args: OpArgs<O>): Promise<Outcome> {
    try {
      await run(op, args);
      await api.refresh();
      return null;
    } catch (e) {
      return codeOf(e);
    }
  }

  const api = {
    /** Loads the Friends tab (and presence). Quiet when signed out. */
    async refresh(): Promise<void> {
      if (!ctx.account.linked) {
        ctx.set({ social: null, socialStatus: 'idle' });
        return;
      }
      if (!ctx.get().social) ctx.set({ socialStatus: 'loading' });
      try {
        ctx.set({ social: await run('social_state', {}, { mutation: false }), socialStatus: 'ready' });
      } catch {
        ctx.set({ socialStatus: 'offline' });
      }
    },

    async setHandle(name: string): Promise<Outcome> {
      try {
        const { profile } = await run('set_handle', { name });
        const social = ctx.get().social;
        if (social) ctx.set({ social: { ...social, me: profile } });
        await api.refresh();
        return null;
      } catch (e) {
        return codeOf(e);
      }
    },

    /** Step 7.3: an exact `name#tag`. The first request may show the push explanation. */
    async addFriend(text: string): Promise<{ outcome: Outcome; status?: 'pending' | 'accepted' }> {
      const handle = parseHandle(text);
      if (!handle) return { outcome: 'handle_invalid' };
      try {
        const res = await run('friend_request', handle);
        ctx.askPush();
        await api.refresh();
        return { outcome: null, status: res.status };
      } catch (e) {
        return { outcome: codeOf(e) };
      }
    },

    async respond(userId: string, accept: boolean): Promise<Outcome> {
      const outcome = await act('friend_respond', { userId, accept });
      if (!outcome && accept) ctx.askPush();
      return outcome;
    },
    cancel: (userId: string) => act('friend_cancel', { userId }),
    remove: (userId: string) => act('friend_remove', { userId }),
    block: (userId: string) => act('block_user', { userId }),
    unblock: (userId: string) => act('unblock_user', { userId }),
    report: (userId: string, reason: ReportReason, note: string, context: 'friends' | 'group' | 'visit') => act('report_user', { userId, reason, note, context }),

    /** Step 7.4: opens visit mode; a snapshot is reused for 60 s (also after a prefetch). */
    async visit(userId: string): Promise<Outcome> {
      try {
        ctx.set({ visit: await api.snapshot(userId) });
        return null;
      } catch (e) {
        return codeOf(e);
      }
    },
    async snapshot(userId: string): Promise<IslandSnapshot> {
      const cached = snapshots.get(userId);
      if (cached && ctx.now() - cached.at < balance.social.snapshotCacheMs) return cached.snapshot;
      const { snapshot } = await run('get_island_snapshot', { userId }, { mutation: false });
      snapshots.set(userId, { at: ctx.now(), snapshot });
      return snapshot;
    },
    /** Prefetch on hover (web) or press (touch); errors are ignored until the real visit. */
    prefetch(userId: string): void {
      void api.snapshot(userId).catch(() => undefined);
    },
    leaveVisit(): void {
      ctx.set({ visit: null });
    },

    // --- Focus together (Step 7.7) ---

    async createRoom(plannedMs: number, invitees: string[]): Promise<Outcome> {
      try {
        const { room } = await run('together_create', { plannedMs, invitees });
        ctx.set({ room });
        ctx.askPush();
        return null;
      } catch (e) {
        return codeOf(e);
      }
    },
    async joinRoom(roomId: string): Promise<Outcome> {
      try {
        ctx.set({ room: (await run('together_join', { roomId })).room });
        return null;
      } catch (e) {
        return codeOf(e);
      }
    },
    async leaveRoom(): Promise<void> {
      const room = ctx.get().room;
      ctx.set({ room: null });
      if (room && room.status === 'lobby') await run('together_leave', { roomId: room.id }).catch(() => undefined);
    },
    async startRoom(): Promise<Outcome> {
      const room = ctx.get().room;
      if (!room) return 'not_found';
      try {
        ctx.set({ room: (await run('together_start', { roomId: room.id })).room });
        return null;
      } catch (e) {
        return codeOf(e);
      }
    },
    /** Polls the room (lobby, silently during Focus, the Break strip). */
    async pollRoom(): Promise<RoomView | null> {
      const room = ctx.get().room;
      if (!room) return null;
      try {
        const next = (await run('together_room', { roomId: room.id }, { mutation: false })).room;
        if (ctx.get().room?.id === room.id) ctx.set({ room: next });
        return next;
      } catch {
        return room;
      }
    },
    clearRoom(): void {
      ctx.set({ room: null });
    },
  };
  return api;
}

export type Social = ReturnType<typeof createSocial>;

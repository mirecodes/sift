import type { ErrorCode, Platform } from '../../shared/api/types';
import type { PushCategory } from '../../shared/rules/push';
import type { Notice } from '../../shared/types/rows';
import type { ServerDb, Tx } from './db';
import type { ProfileRow, Rows, TableName } from './schema';

/** A typed failure: the client gets `{ ok: false, error: { code } }` and maps it to its own words. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly retryAfterMs?: number,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/** Side effects outside the database (auth admin, push), provided by the host (edge function or fake). */
export interface ServerHooks {
  deleteAuthUser?(userId: string): Promise<void>;
  /**
   * Sends one push message to a user's devices (Step 6.6). The core already applied the focus rule; the
   * host skips devices that turned the category off.
   */
  push?(userId: string, message: PushMessage): Promise<void>;
}

export interface PushMessage {
  category: PushCategory;
  title: string;
  body: string;
  /** A deep-link path the app opens on tap (Step 6.5), e.g. `/war/<id>`. */
  url?: string;
}

/** Everything the server core needs from its host. Injected so tests control time and chance. */
export interface ServerEnv {
  db: ServerDb;
  now(): number;
  /** Uniform [0, 1). Cryptographic in production (rewards, war seeds). */
  random(): number;
  uuid(): string;
  hooks?: ServerHooks;
}

export interface Caller {
  /** Authenticated user, or null (only public operations). */
  userId: string | null;
  platform: Platform;
  appVersion: string;
  apiVersion: number;
}

/**
 * Writes one user's rows with the next delta-sync sequence number. One number per transaction: the
 * client either sees all of a change or none of it.
 */
export class UserWriter {
  private seq: number | null = null;
  /** Notices written for this user in this transaction (push candidates, Step 6.6). */
  readonly noticed: Notice[] = [];

  constructor(
    private readonly tx: Tx,
    readonly userId: string,
  ) {}

  private async next(): Promise<number> {
    if (this.seq === null) {
      const profile = await this.profile();
      this.seq = profile.seq + 1;
    }
    return this.seq;
  }

  async profile(): Promise<ProfileRow> {
    const p = await this.tx.table('profiles').get(this.userId);
    if (!p) throw new ApiError('unauthorized');
    return p;
  }

  /** Inserts or replaces an owned row, stamped with this user and the transaction's sequence number. */
  async put<T extends OwnedTable>(table: T, row: Omit<Rows[T], 'userId' | 'updatedSeq'>): Promise<Rows[T]> {
    const full = { ...row, userId: this.userId, updatedSeq: await this.next() } as Rows[T];
    await this.tx.table(table).put(full);
    return full;
  }

  /** Like `put`, but fails when the key exists (rows a client names, e.g. an uploaded save). */
  async insert<T extends OwnedTable>(table: T, row: Omit<Rows[T], 'userId' | 'updatedSeq'>): Promise<Rows[T]> {
    const full = { ...row, userId: this.userId, updatedSeq: await this.next() } as Rows[T];
    await this.tx.table(table).insert(full);
    return full;
  }

  /** Stores the sequence number used (call once at the end of the transaction). */
  async finish(): Promise<void> {
    if (this.seq === null) return;
    const profile = await this.profile();
    await this.tx.table('profiles').put({ ...profile, seq: this.seq });
  }
}

export type OwnedTable = {
  [T in TableName]: Rows[T] extends { userId: string; updatedSeq: number } ? T : never;
}[TableName];

/** What a handler gets: the transaction, the caller and a writer for the caller's rows. */
export interface HandlerCtx {
  env: ServerEnv;
  tx: Tx;
  caller: Caller;
  userId: string;
  w: UserWriter;
  now: number;
  /** Writers for other users touched by this request (war, missions); finished with the caller's. */
  writerFor(userId: string): Promise<UserWriter>;
}

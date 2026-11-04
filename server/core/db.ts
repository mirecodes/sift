import { filterable, keyOf, TABLES, type Rows, type TableName } from './schema';

/** A row with this key (or unique columns) already exists. */
export class DuplicateKeyError extends Error {
  constructor(readonly table: string) {
    super(`duplicate key in ${table}`);
    this.name = 'DuplicateKeyError';
  }
}

export interface Table<R> {
  get(key: string): Promise<R | undefined>;
  /** Equality filter on key, index or owned columns (`filterable`). */
  find(where: Partial<R>): Promise<R[]>;
  /** Fails with `DuplicateKeyError` when the key or a unique column set is taken. */
  insert(row: R): Promise<void>;
  /** Insert or replace by key. */
  put(row: R): Promise<void>;
  delete(key: string): Promise<void>;
  /** Owned tables: this user's rows changed after `seq` (delta sync). */
  since(userId: string, seq: number): Promise<R[]>;
}

export interface Tx {
  table<T extends TableName>(name: T): Table<Rows[T]>;
  /** Serializes everything one user's data goes through until the transaction ends. */
  lockUser(userId: string): Promise<void>;
}

/** All server state. Every request runs in one transaction: all of it is written, or none. */
export interface ServerDb {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

const check = (table: TableName, where: object) => {
  const allowed = new Set(filterable(table));
  for (const k of Object.keys(where)) if (!allowed.has(k)) throw new Error(`${table}: cannot filter on ${k}`);
};

/** Validates filters the same way for every adapter (a typo must fail in tests, not in production). */
export const assertFilter = check;

type Snapshot = Map<TableName, Map<string, unknown>>;

/**
 * In-memory server database (tests, `FakeRemote`, offline development). Transactions run one at a time;
 * each sees its own copy of the tables it writes and commits them at the end, or drops them on error.
 * `onCommit` lets the fake remote persist a snapshot.
 */
export class MemoryServerDb implements ServerDb {
  private data: Snapshot = new Map();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly onCommit?: (dump: Record<string, unknown[]>) => void) {}

  /** Every row by table (fake remote persistence, tests). */
  dump(): Record<string, unknown[]> {
    return Object.fromEntries([...this.data].map(([t, rows]) => [t, [...rows.values()]]));
  }

  load(dump: Record<string, unknown[]>): void {
    this.data = new Map();
    for (const [t, rows] of Object.entries(dump)) {
      if (!(t in TABLES)) continue;
      this.data.set(t as TableName, new Map(rows.map((r) => [keyOf(t as TableName, r as object), r])));
    }
  }

  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const run = this.queue.then(() => this.run(fn));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const written: Snapshot = new Map();
    const tableOf = (name: TableName): Map<string, unknown> => {
      let t = written.get(name);
      if (!t) {
        t = new Map(this.data.get(name) ?? []);
        written.set(name, t);
      }
      return t;
    };
    const read = (name: TableName) => written.get(name) ?? this.data.get(name) ?? new Map<string, unknown>();
    const clone = <R>(r: R): R => structuredClone(r);
    const matches = (row: Record<string, unknown>, where: object) => Object.entries(where).every(([k, v]) => row[k] === v);

    const tx: Tx = {
      table: <T extends TableName>(name: T) => {
        type R = Rows[T];
        const spec = TABLES[name];
        const uniqueTaken = (row: R, rows: Map<string, unknown>, self: string) => {
          const r = row as unknown as Record<string, unknown>;
          return (spec.unique ?? []).some((cols) =>
            [...rows].some(([k, other]) => k !== self && cols.every((c) => r[c] != null && r[c] === (other as Record<string, unknown>)[c])),
          );
        };
        return {
          async get(key) {
            const r = read(name).get(key);
            return r === undefined ? undefined : clone(r as R);
          },
          async find(where) {
            check(name, where);
            return [...read(name).values()].filter((r) => matches(r as Record<string, unknown>, where)).map((r) => clone(r as R));
          },
          async insert(row) {
            const t = tableOf(name);
            const key = keyOf(name, row as object);
            if (t.has(key) || uniqueTaken(row, t, key)) throw new DuplicateKeyError(name);
            t.set(key, clone(row));
          },
          async put(row) {
            const t = tableOf(name);
            const key = keyOf(name, row as object);
            if (uniqueTaken(row, t, key)) throw new DuplicateKeyError(name);
            t.set(key, clone(row));
          },
          async delete(key) {
            tableOf(name).delete(key);
          },
          async since(userId, seq) {
            return [...read(name).values()]
              .filter((r) => (r as { userId: string }).userId === userId && (r as { updatedSeq: number }).updatedSeq > seq)
              .map((r) => clone(r as R));
          },
        } satisfies Table<R>;
      },
      async lockUser() {
        // Transactions already run one at a time.
      },
    };

    const result = await fn(tx);
    for (const [name, rows] of written) this.data.set(name, rows);
    this.onCommit?.(this.dump());
    return result;
  }
}

import { migrateRows, SCHEMA_VERSION } from '../../db/migrations';
import type { StorageAdapter } from './index';
import { createRowStorage, keyOfRow, STORES, type Row, type RowBackend, type Store } from './rows';

/**
 * A SQLite connection, as the adapter needs it: the Capacitor plugin on iOS and Android
 * (`platform/native/sqliteDriver.ts`), Node's `node:sqlite` in tests.
 */
export interface SqlDriver {
  exec(sql: string): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  run(sql: string, params?: unknown[]): Promise<void>;
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

const SCHEMA = `
create table if not exists rows (store text not null, id text not null, json text not null, primary key (store, id));
create table if not exists meta (key text primary key, value text not null);
`;

/**
 * The durable local save on iOS and Android (guidance_v2 Step 6.2): WebView storage can be cleared by
 * the OS, a SQLite file cannot. Same stores, rows and migrations as IndexedDB (`createRowStorage`,
 * `migrateRows`); one table of JSON rows keyed by store and id. Transactions serialize.
 */
export function createSqliteStorage(open: () => Promise<SqlDriver>): StorageAdapter {
  let ready: Promise<SqlDriver> | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  async function init(): Promise<SqlDriver> {
    const db = await open();
    await db.exec(SCHEMA);
    const [row] = await db.query("select value from meta where key = 'schema'");
    const stored = row ? Number(row.value) : null;
    if (stored !== null && stored < SCHEMA_VERSION) {
      // An older app wrote this file: upgrade every row with the shared row migrations.
      const data: Record<string, unknown[]> = {};
      for (const r of await db.query('select store, json from rows')) (data[r.store as string] ??= []).push(JSON.parse(r.json as string));
      const upgraded = migrateRows(data, stored);
      await db.begin();
      try {
        await db.run('delete from rows');
        for (const [store, rows] of Object.entries(upgraded)) {
          if (!(store in STORES)) continue;
          for (const r of rows) await db.run('insert into rows (store, id, json) values (?, ?, ?)', [store, keyOfRow(store as Store, r as Row), JSON.stringify(r)]);
        }
        await db.commit();
      } catch (e) {
        await db.rollback();
        throw e;
      }
    }
    await db.run("insert or replace into meta (key, value) values ('schema', ?)", [String(SCHEMA_VERSION)]);
    return db;
  }

  const backend: RowBackend = {
    transaction<T>(fn: Parameters<RowBackend['transaction']>[0]): Promise<T> {
      const run = queue.then(async () => {
        const db = await (ready ??= init());
        await db.begin();
        try {
          const out = await fn({
            all: async (store) => (await db.query('select json from rows where store = ?', [store])).map((r) => JSON.parse(r.json as string) as Row),
            has: async (store, key) => (await db.query('select 1 from rows where store = ? and id = ?', [store, key])).length > 0,
            put: (store, row) => db.run('insert or replace into rows (store, id, json) values (?, ?, ?)', [store, keyOfRow(store, row), JSON.stringify(row)]),
            delete: (store, key) => db.run('delete from rows where store = ? and id = ?', [store, key]),
            clear: (store) => db.run('delete from rows where store = ?', [store]),
          });
          await db.commit();
          return out as T;
        } catch (e) {
          await db.rollback();
          throw e;
        }
      });
      queue = run.catch(() => undefined);
      return run;
    },
  };
  return createRowStorage(backend, SCHEMA_VERSION);
}

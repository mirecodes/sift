import type { SqlDriver } from '../storage/sqlite';
import type { CapacitorSQLite as Plugin, SQLiteConnection as Connection } from './plugins';

/**
 * `@capacitor-community/sqlite` as the storage adapter's driver: one database file `sift` in the app's
 * private storage. Statements run outside the plugin's own implicit transactions; the adapter opens and
 * closes its transactions itself.
 */
export async function openCapacitorSqlite(lib: { CapacitorSQLite: typeof Plugin; SQLiteConnection: typeof Connection }): Promise<SqlDriver> {
  const sqlite = new lib.SQLiteConnection(lib.CapacitorSQLite);
  const name = 'sift';
  const consistent = (await sqlite.checkConnectionsConsistency()).result;
  const exists = (await sqlite.isConnection(name, false)).result;
  const db = consistent && exists ? await sqlite.retrieveConnection(name, false) : await sqlite.createConnection(name, false, 'no-encryption', 1, false);
  await db.open();
  return {
    exec: async (sql) => void (await db.execute(sql, false)),
    query: async (sql, params = []) => ((await db.query(sql, params)).values ?? []) as Record<string, unknown>[],
    run: async (sql, params = []) => void (await db.run(sql, params, false)),
    begin: async () => void (await db.beginTransaction()),
    commit: async () => void (await db.commitTransaction()),
    rollback: async () => void (await db.rollbackTransaction()),
  };
}

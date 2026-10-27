import type { SqlClient } from './pgDb';

/** The PGlite driver (Postgres compiled to WebAssembly) as a `SqlClient`: local tests of the real SQL. */
export function pgliteClient(db: { transaction<T>(fn: (tx: { query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }> }) => Promise<T>): Promise<T> }): SqlClient {
  return {
    transaction: (fn) => db.transaction((tx) => fn(async (text, params) => ({ rows: (await tx.query(text, params)).rows as Record<string, unknown>[] }))),
  };
}

import { assertFilter, DuplicateKeyError, type ServerDb, type Table, type Tx } from '../core/db';
import { TABLES, type Rows, type TableName } from '../core/schema';
import { columns, snake } from './sql';

/** One query function: `$1`-style parameters, rows back. */
export type SqlQuery = (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

/** What the adapter needs from a Postgres driver: porsager `postgres` on Deno, PGlite in tests. */
export interface SqlClient {
  transaction<T>(fn: (query: SqlQuery) => Promise<T>): Promise<T>;
}

const isUnique = (e: unknown) => (e as { code?: string })?.code === '23505';

/** Column value of a row field: text columns store strings (equality filters only). */
const columnValue = (type: string, v: unknown) => (v == null ? null : type === 'text' ? String(v) : v);

function table<T extends TableName>(q: SqlQuery, name: T): Table<Rows[T]> {
  type R = Rows[T];
  const spec = TABLES[name];
  const cols = columns(name);
  const types = new Map(cols);
  const keyWhere = (offset = 0) => spec.key.map((k, i) => `${snake(k)} = $${i + 1 + offset}`).join(' and ');
  // Composite keys are joined with `|`; a single-column key may itself contain `|` (e.g. a pair key).
  const keyParams = (key: string) => (spec.key.length === 1 ? [key] : key.split('|'));
  const values = (row: R) => [...cols.map(([f, t]) => columnValue(t, (row as unknown as Record<string, unknown>)[f])), JSON.stringify(row)];
  const colList = [...cols.map(([f]) => snake(f)), 'data'].join(', ');
  const placeholders = [...cols.map((_, i) => `$${i + 1}`), `$${cols.length + 1}::jsonb`].join(', ');
  const write = async (sql: string, row: R) => {
    try {
      await q(sql, values(row));
    } catch (e) {
      if (isUnique(e)) throw new DuplicateKeyError(name);
      throw e;
    }
  };
  return {
    async get(key) {
      const { rows } = await q(`select data from public.${name} where ${keyWhere()}`, keyParams(key));
      return rows[0]?.data as R | undefined;
    },
    async find(where) {
      assertFilter(name, where);
      const entries = Object.entries(where);
      const cond = entries.map(([k], i) => `${snake(k)} = $${i + 1}`).join(' and ');
      const { rows } = await q(`select data from public.${name}${cond ? ` where ${cond}` : ''}`, entries.map(([k, v]) => columnValue(types.get(k) ?? 'text', v)));
      return rows.map((r) => r.data as R);
    },
    insert: (row) => write(`insert into public.${name} (${colList}) values (${placeholders})`, row),
    put: (row) =>
      write(
        `insert into public.${name} (${colList}) values (${placeholders}) on conflict (${spec.key.map(snake).join(', ')}) do update set ${[...cols.map(([f]) => snake(f)), 'data']
          .map((c) => `${c} = excluded.${c}`)
          .join(', ')}`,
        row,
      ),
    async delete(key) {
      await q(`delete from public.${name} where ${keyWhere()}`, keyParams(key));
    },
    async since(userId, seq) {
      const { rows } = await q(`select data from public.${name} where user_id = $1 and updated_seq > $2`, [userId, seq]);
      return rows.map((r) => r.data as R);
    },
  };
}

/** The server database on Postgres (Supabase), one SQL transaction per API call (ADR-047). */
export function createPgServerDb(client: SqlClient): ServerDb {
  return {
    transaction: (fn) =>
      client.transaction((q) => {
        const tx: Tx = {
          table: (name) => table(q, name),
          async lockUser(userId) {
            await q('select pg_advisory_xact_lock(hashtext($1))', [userId]);
          },
        };
        return fn(tx);
      }),
  };
}

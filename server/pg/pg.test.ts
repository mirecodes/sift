import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { describeContract } from '../core/contract.suite';
import { TABLES } from '../core/schema';
import { createPgServerDb } from './pgDb';
import { pgliteClient } from './pglite';
import { MIGRATIONS, migrationFile, migrationSql } from './sql';

const committed = (n: number) => readFileSync(new URL(`../supabase/migrations/${migrationFile(n)}`, import.meta.url), 'utf8');

async function migrated(): Promise<PGlite> {
  const pg = new PGlite();
  for (const n of MIGRATIONS) await pg.exec(committed(n));
  return pg;
}

describe('Postgres schema (server/supabase/migrations)', () => {
  it('matches the generator (run `npm run server:sql` after changing server/core/schema.ts)', () => {
    for (const n of MIGRATIONS) expect(committed(n)).toBe(migrationSql(n));
  });

  it('applies cleanly twice, with row-level security on every table', async () => {
    const pg = await migrated();
    for (const n of MIGRATIONS) await pg.exec(committed(n));
    const { rows } = await pg.query<{ relname: string; relrowsecurity: boolean }>("select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'");
    expect(rows.map((r) => r.relname).sort()).toEqual(Object.keys(TABLES).sort());
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});

describeContract('postgres (PGlite)', async () => createPgServerDb(pgliteClient(await migrated())));

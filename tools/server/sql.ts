import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MIGRATIONS, migrationFile, migrationSql } from '../../server/pg/sql';

export const MIGRATIONS_DIR = 'server/supabase/migrations';

/** `npm run server:sql`: writes the SQL migrations generated from `server/core/schema.ts`. */
export function main(): number {
  mkdirSync(MIGRATIONS_DIR, { recursive: true });
  for (const n of MIGRATIONS) {
    const file = join(MIGRATIONS_DIR, migrationFile(n));
    writeFileSync(file, migrationSql(n));
    console.log(`wrote ${file}`);
  }
  return 0;
}

import 'fake-indexeddb/auto';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createDexieStorage } from '../../db/repositories';
import { SiftDB } from '../../db/schema';
import { describeStorageContract } from './contract.suite';
import { createMemoryStorage } from './memory';
import { createSqliteStorage, type SqlDriver } from './sqlite';

/** `node:sqlite` as the adapter's driver (the Capacitor plugin plays this role on phones). */
function nodeDriver(db: DatabaseSync): SqlDriver {
  return {
    exec: async (sql) => db.exec(sql),
    query: async (sql, params = []) => db.prepare(sql).all(...(params as never[])) as Record<string, unknown>[],
    run: async (sql, params = []) => void db.prepare(sql).run(...(params as never[])),
    begin: async () => db.exec('begin'),
    commit: async () => db.exec('commit'),
    rollback: async () => db.exec('rollback'),
  };
}

let n = 0;
describeStorageContract('memory', () => createMemoryStorage());
describeStorageContract('indexeddb (Dexie)', () => createDexieStorage(new SiftDB(`contract-${++n}`)));
describeStorageContract('sqlite', () => createSqliteStorage(async () => nodeDriver(new DatabaseSync(':memory:'))));

describe('sqlite storage', () => {
  it('keeps data in the file across opens and upgrades rows an older app wrote', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('create table rows (store text not null, id text not null, json text not null, primary key (store, id)); create table meta (key text primary key, value text not null);');
    db.prepare("insert into meta values ('schema', '3')").run();
    db.prepare('insert into rows values (?, ?, ?)').run('animals', 'a1', JSON.stringify({ id: 'a1', speciesId: 'chick', tier: 'common', tileX: 1, tileZ: 1, acquiredAt: 5, sessionId: 's' }));
    const s = createSqliteStorage(async () => nodeDriver(db));
    expect((await s.load()).animals[0]).toMatchObject({ id: 'a1', status: 'active', verified: true, tierRank: 0 });
    const again = createSqliteStorage(async () => nodeDriver(db));
    expect((await again.load()).animals).toHaveLength(1);
  });
});

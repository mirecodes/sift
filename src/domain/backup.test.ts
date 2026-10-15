import { describe, expect, it } from 'vitest';
import { backupFileName, createBackup, parseBackup, summarizeBackup } from './backup';

const data = {
  kv: [{ key: 'settings', value: { focusMinutes: 30 } }],
  sessions: [{ id: 's1' }, { id: 's2' }],
  animals: [{ id: 'a1' }],
};
const NOW = Date.UTC(2026, 9, 7, 12);

describe('backup', () => {
  it('round-trips through JSON', () => {
    const backup = createBackup(data, 3, NOW);
    expect(backup).toMatchObject({ format: 'sift-backup', version: 1, exportedAt: '2026-10-07T12:00:00.000Z', schemaVersion: 3 });
    expect(parseBackup(JSON.stringify(backup), 3)).toEqual({ ok: true, backup });
  });

  it('summarizes sessions and animals', () => {
    expect(summarizeBackup(createBackup(data, 3, NOW))).toEqual({ exportedAt: NOW, sessions: 2, animals: 1 });
  });

  it('names the file by export date', () => {
    expect(backupFileName(createBackup(data, 3, NOW))).toBe('sift-backup-2026-10-07.json');
  });

  it.each([
    ['not JSON', '{'],
    ['wrong format', JSON.stringify({ ...createBackup(data, 3, NOW), format: 'other' })],
    ['missing store', JSON.stringify(createBackup({ kv: [], sessions: [] }, 3, NOW))],
    ['rows not objects', JSON.stringify(createBackup({ ...data, animals: [1] }, 3, NOW))],
    ['row without key', JSON.stringify(createBackup({ ...data, sessions: [{ startedAt: 1 }] }, 3, NOW))],
    ['missing version', JSON.stringify({ ...createBackup(data, 3, NOW), version: undefined })],
    ['array', '[]'],
  ])('rejects %s', (_, text) => {
    expect(parseBackup(text, 3)).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejects backups from a newer format or schema', () => {
    expect(parseBackup(JSON.stringify({ ...createBackup(data, 3, NOW), version: 2 }), 3)).toEqual({ ok: false, error: 'newer' });
    expect(parseBackup(JSON.stringify(createBackup(data, 4, NOW)), 3)).toEqual({ ok: false, error: 'newer' });
  });

  it('accepts extra stores', () => {
    expect(parseBackup(JSON.stringify(createBackup({ ...data, ledger: [{ id: 'l1' }] }, 3, NOW)), 3).ok).toBe(true);
  });
});

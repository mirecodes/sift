import { describe, expect, it } from 'vitest';
import { IDLE, startBreak, startFocus } from '../timer/phase';
import type { InboxRow } from '../types';
import { canShowNotices, currentNotice } from './inbox';

const row = (id: string, createdAt: number): InboxRow => ({ id, createdAt, notice: { kind: 'animals_departed', animalIds: [id], gold: 1 } });

describe('inbox rules', () => {
  it('shows notices only on Home (idle) and Break', () => {
    expect(canShowNotices(IDLE)).toBe(true);
    expect(canShowNotices(startBreak(0, 1))).toBe(true);
    expect(canShowNotices(startFocus(0, 1, 's'))).toBe(false);
  });

  it('shows the oldest notice first, one at a time', () => {
    const inbox = [row('b', 20), row('a', 10), row('c', 30)];
    expect(currentNotice(inbox, IDLE)?.id).toBe('a');
    expect(currentNotice(inbox, startFocus(0, 1, 's'))).toBeUndefined();
    expect(currentNotice([], IDLE)).toBeUndefined();
  });
});

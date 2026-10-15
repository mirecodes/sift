import { describe, expect, it } from 'vitest';
import { IDLE, startBreak, startFocus } from '../timer/phase';
import type { InboxRow } from '../types';
import { canShowNotices, currentNotice, pendingDepartures } from './inbox';

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

  it('keeps leaving animals and their gold back until their notice shows (Step 2.3)', () => {
    const departed = (id: string, createdAt: number, animalIds: string[], gold: number): InboxRow => ({ id, createdAt, notice: { kind: 'animals_departed', animalIds, gold } });
    const inbox = [departed('n2', 20, ['c'], 8), departed('n1', 10, ['a', 'b'], 4), { id: 'f', createdAt: 5, notice: { kind: 'friend_request' as const, userId: 'u' } }];
    // The friend request is the oldest, so nothing departs yet and all gold is held.
    let p = pendingDepartures(inbox, IDLE);
    expect([...p.leaving].sort()).toEqual(['a', 'b', 'c']);
    expect(p.departing).toEqual([]);
    expect(p.heldGold).toBe(12);

    p = pendingDepartures(inbox.slice(0, 2), IDLE);
    expect(p.departing).toEqual(['a', 'b']);
    expect(p.heldGold).toBe(8);

    p = pendingDepartures(inbox.slice(0, 2), startFocus(0, 1, 's'));
    expect(p.departing).toEqual([]); // never during Focus
    expect(p.heldGold).toBe(12);
    expect(pendingDepartures([], IDLE)).toEqual({ leaving: new Set(), departing: [], heldGold: 0 });
  });
});

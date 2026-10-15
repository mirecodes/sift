import { describe, expect, it } from 'vitest';
import { balance } from '../../../shared/balance/balance';
import { debitEntry, goldBalance, goldEntry, goldPileLevel, hasStarterGrant, InsufficientGoldError, LEDGER_REASON } from './ledger';

describe('ledger', () => {
  it('sums credits and debits', () => {
    expect(goldBalance([])).toBe(0);
    expect(goldBalance([goldEntry('a', 1, 30, 'starter', null), goldEntry('b', 2, 8, 'expiry', 'x'), goldEntry('c', 3, -25, 'purchase', 'y')])).toBe(13);
  });

  it('debits only what the balance covers', () => {
    expect(debitEntry(10, 10, LEDGER_REASON.purchase, 'fence', 'd', 5)).toEqual({ id: 'd', at: 5, currency: 'gold', amount: -10, reason: 'purchase', refId: 'fence' });
    expect(() => debitEntry(9, 10, LEDGER_REASON.purchase, 'fence', 'd', 5)).toThrow(InsufficientGoldError);
  });

  it('rejects zero, negative and fractional amounts', () => {
    expect(() => debitEntry(10, 0, 'purchase', null, 'd', 5)).toThrow(RangeError);
    expect(() => debitEntry(10, -3, 'purchase', null, 'd', 5)).toThrow(RangeError);
    expect(() => debitEntry(10, 1.5, 'purchase', null, 'd', 5)).toThrow(RangeError);
    expect(() => goldEntry('a', 1, 0, 'expiry', null)).toThrow(RangeError);
  });

  it('maps the balance to a coin pile level with the balance thresholds', () => {
    const t = balance.economy.pileThresholds;
    expect([0, 1, 9, 10, 29, 30, 99, 100, 299, 300, 999, 1000, 50_000].map((g) => goldPileLevel(g, t))).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
    expect(goldPileLevel(-5, t)).toBe(0);
  });

  it('detects the starter grant', () => {
    expect(hasStarterGrant([])).toBe(false);
    expect(hasStarterGrant([goldEntry('a', 1, 30, LEDGER_REASON.starter, null)])).toBe(true);
  });
});

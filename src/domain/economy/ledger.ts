import type { LedgerEntry } from '../types';

/** Why gold moved. Stored as text so later phases can add reasons without a migration. */
export const LEDGER_REASON = { starter: 'starter', expiry: 'expiry', purchase: 'purchase', weekly: 'weekly_win', mission: 'mission', war: 'war_loot', warLost: 'war_loot_lost' } as const;

/** The wallet balance: the sum of every gold entry. The ledger is append-only. */
export const goldBalance = (entries: readonly LedgerEntry[]): number =>
  entries.reduce((sum, e) => sum + (e.currency === 'gold' ? e.amount : 0), 0);

export class InsufficientGoldError extends Error {
  constructor(
    readonly needed: number,
    readonly balance: number,
  ) {
    super(`Needs ${needed} gold, has ${balance}.`);
    this.name = 'InsufficientGoldError';
  }
}

export function goldEntry(id: string, at: number, amount: number, reason: string, refId: string | null): LedgerEntry {
  if (!Number.isInteger(amount) || amount === 0) throw new RangeError(`Invalid gold amount ${amount}`);
  return { id, at, currency: 'gold', amount, reason, refId };
}

/** The debit for spending `amount` (a positive integer); throws `InsufficientGoldError` when the balance is short. */
export function debitEntry(balance: number, amount: number, reason: string, refId: string | null, id: string, at: number): LedgerEntry {
  if (!Number.isInteger(amount) || amount <= 0) throw new RangeError(`Invalid price ${amount}`);
  if (amount > balance) throw new InsufficientGoldError(amount, balance);
  return goldEntry(id, at, -amount, reason, refId);
}

/** Coin pile size 0..thresholds.length: how many thresholds the balance reaches (Step 2.4). */
export const goldPileLevel = (gold: number, thresholds: readonly number[]): number => thresholds.filter((t) => gold >= t).length;

/** The one-time starter grant has been given on this save. */
export const hasStarterGrant = (entries: readonly LedgerEntry[]): boolean => entries.some((e) => e.reason === LEDGER_REASON.starter);

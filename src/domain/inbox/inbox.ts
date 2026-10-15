import type { StoredPhase } from '../timer/phase';
import type { InboxRow } from '../types';
import type { Notice } from './notice';

export type { Notice };

/** Notices are shown, and may be dismissed, only on Home (idle) or Break; never while focusing (ADR-035). */
export const canShowNotices = (phase: StoredPhase): boolean => phase.kind === 'idle' || phase.kind === 'break';

export interface PendingDepartures {
  /** Departed animals whose notice is still queued: they stay on the island until it is shown. */
  leaving: ReadonlySet<string>;
  /** The shown notice's animals, in notice order: their departure plays now. */
  departing: readonly string[];
  /** Gold of queued departure notices not shown yet: the HUD holds it back until they show. */
  heldGold: number;
}

/** Departure notices tie the visuals to the moment they are shown, not when the data changed (§2.9, Step 2.3). */
export function pendingDepartures(inbox: readonly InboxRow[], phase: StoredPhase): PendingDepartures {
  const current = currentNotice(inbox, phase);
  const leaving = new Set<string>();
  let departing: string[] = [];
  let heldGold = 0;
  for (const row of inbox) {
    if (row.notice.kind !== 'animals_departed') continue;
    for (const id of row.notice.animalIds) leaving.add(id);
    if (row === current) departing = row.notice.animalIds;
    else heldGold += row.notice.gold;
  }
  return { leaving, departing, heldGold };
}

/** The notice to show now: the oldest queued one, or `undefined` while focusing or when empty. */
export function currentNotice(inbox: readonly InboxRow[], phase: StoredPhase): InboxRow | undefined {
  if (!canShowNotices(phase)) return undefined;
  return inbox.reduce<InboxRow | undefined>((oldest, row) => (!oldest || row.createdAt < oldest.createdAt ? row : oldest), undefined);
}

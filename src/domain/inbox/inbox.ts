import type { StoredPhase } from '../timer/phase';
import type { InboxRow } from '../types';
import type { Notice } from './notice';

export type { Notice };

/** Notices are shown, and may be dismissed, only on Home (idle) or Break; never while focusing (ADR-035). */
export const canShowNotices = (phase: StoredPhase): boolean => phase.kind === 'idle' || phase.kind === 'break';

/** The notice to show now: the oldest queued one, or `undefined` while focusing or when empty. */
export function currentNotice(inbox: readonly InboxRow[], phase: StoredPhase): InboxRow | undefined {
  if (!canShowNotices(phase)) return undefined;
  return inbox.reduce<InboxRow | undefined>((oldest, row) => (!oldest || row.createdAt < oldest.createdAt ? row : oldest), undefined);
}

import type { FocusSession } from '../../shared/types/rows';
import type { HandlerCtx } from './context';

/**
 * Work later phases attach to core operations without core importing them: a completed, verified
 * session counts for the group mission (Step 8.5) in the same transaction as `end_session`.
 */
export const afterSessionCompleted: ((c: HandlerCtx, session: FocusSession) => Promise<void>)[] = [];

/** Before an account's rows are deleted (Step 5.4): groups hand ownership on or close. */
export const beforeAccountDelete: ((c: HandlerCtx) => Promise<void>)[] = [];

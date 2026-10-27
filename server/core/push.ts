import { pushCategoryOf } from '../../shared/rules/push';
import type { Notice } from '../../shared/types/rows';
import type { PushMessage, ServerEnv, UserWriter } from './context';
import type { Tx } from './db';
import { focusingNow } from './user';

/** A push to send once the transaction that wrote its notice has committed. */
export interface PushJob {
  userId: string;
  message: PushMessage;
}

/** The words of a push. Short and name-free: the Inbox carries the details. */
function messageFor(notice: Notice): Omit<PushMessage, 'category'> | null {
  switch (notice.kind) {
    case 'friend_request':
      return { title: 'New friend request', body: 'Open Sift to answer it.' };
    case 'together_invite':
      return { title: 'Focus together?', body: 'A friend invited you to a focus session.' };
    case 'group_invite':
      return { title: 'Group invite', body: 'You were invited to join a group.' };
    case 'joined_group':
      return { title: 'New group member', body: 'Someone joined your group.' };
    case 'mission_milestone':
      return { title: 'Group mission', body: `Your group reached a milestone: +${notice.gold} gold.` };
    case 'war_report':
      return { title: 'Your island was raided', body: notice.result === 'win' ? 'Your animals held their ground.' : 'Open Sift to see what happened.', url: `/war/${notice.warId}` };
    case 'weekly_result':
      return { title: 'Weekly results', body: notice.youWon ? 'Your island won the week!' : "This week's group results are in." };
    default:
      return null;
  }
}

/**
 * The pushes for the notices a transaction wrote (Step 6.6). The focus rule: nothing for a user with a
 * running session; the notice waits in the Inbox and shows on Break or Home.
 */
export async function planPushes(tx: Tx, now: number, writers: Iterable<UserWriter>): Promise<PushJob[]> {
  const jobs: PushJob[] = [];
  for (const w of writers) {
    const due = w.noticed.flatMap((notice) => {
      const category = pushCategoryOf(notice);
      const text = category && messageFor(notice);
      return category && text ? [{ userId: w.userId, message: { category, ...text } }] : [];
    });
    if (due.length && !(await focusingNow(tx, w.userId, now))) jobs.push(...due);
  }
  return jobs;
}

/** Sends planned pushes through the host; a failed push never fails the call. */
export async function sendPushes(env: ServerEnv, jobs: readonly PushJob[]): Promise<void> {
  const send = env.hooks?.push;
  if (!send) return;
  for (const job of jobs) await send(job.userId, job.message).catch((e) => console.error('sift api: push failed', e));
}

import type { Notice } from '../types/rows';

/** Push categories a user can turn off one by one (guidance_v2 Step 6.6). */
export const PUSH_CATEGORIES = ['friends', 'together', 'groups', 'war', 'weekly'] as const;
export type PushCategory = (typeof PUSH_CATEGORIES)[number];

/**
 * Which notices also go out as a push, and under which category. The rest only wait in the Inbox.
 * War reports push to the defender only (the attacker watches the battle).
 */
export function pushCategoryOf(notice: Notice): PushCategory | null {
  switch (notice.kind) {
    case 'friend_request':
      return 'friends';
    case 'together_invite':
      return 'together';
    case 'group_invite':
    case 'mission_milestone':
    case 'joined_group':
      return 'groups';
    case 'war_report':
      return notice.role === 'defender' ? 'war' : null;
    case 'weekly_result':
      return 'weekly';
    default:
      return null;
  }
}

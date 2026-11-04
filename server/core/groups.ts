import type { GroupView, MemberView, ScoreView } from '../../shared/api/types';
import { BALANCE_VERSION, balance } from '../../shared/balance/balance';
import { earnsMilestoneGold, milestoneMinutes, milestonesCrossed, missionTarget, sessionMissionMinutes } from '../../shared/rules/missions';
import { islandScore } from '../../shared/rules/scoring';
import { nextWeek, weekOf, weekRange } from '../../shared/rules/week';
import type { FocusSession, PlacedAnimal } from '../../shared/types/rows';
import { LEDGER_REASON } from '../../src/domain/economy/ledger';
import type { HandlerCtx } from './context';
import type { Tx } from './db';
import { afterSessionCompleted, beforeAccountDelete } from './hooks';
import type { GroupMemberRow, GroupRow, MissionWeekRow } from './schema';
import { addRelation, personView } from './social';
import { notify, settleExpirations, strip } from './user';

/** What group work needs from a request or the weekly job. */
export type GroupCtx = Pick<HandlerCtx, 'tx' | 'now' | 'env' | 'writerFor'>;

const HOUR = 3_600_000;
/** Invite code letters: no 0/O, 1/I/L look-alikes. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newInviteCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < balance.social.inviteCodeLength; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

export const membership = (tx: Tx, userId: string): Promise<GroupMemberRow | undefined> => tx.table('group_members').get(userId);

export async function membersOf(tx: Tx, groupId: string): Promise<GroupMemberRow[]> {
  return (await tx.table('group_members').find({ groupId })).sort((a, b) => a.joinedAt - b.joinedAt || a.userId.localeCompare(b.userId));
}

export async function sameGroup(tx: Tx, a: string, b: string): Promise<boolean> {
  const [ma, mb] = await Promise.all([membership(tx, a), membership(tx, b)]);
  return !!ma && ma.groupId === mb?.groupId;
}
// Members of one group see each other's islands and presence (Steps 7.4, 7.6).
addRelation(sameGroup);

/** When a user who left (or disbanded) may join a group again; null when they may now (anti-farming). */
export async function rejoinAt(tx: Tx, userId: string, now: number): Promise<number | null> {
  const last = (await tx.table('group_membership_log').find({ userId })).filter((l) => l.kind === 'leave' || l.kind === 'disband').sort((a, b) => b.at - a.at)[0];
  const until = last ? last.at + balance.social.groupRejoinCooldownHours * HOUR : 0;
  return until > now ? until : null;
}

export async function logMembership(c: GroupCtx, groupId: string, userId: string, kind: 'join' | 'leave' | 'removed' | 'disband'): Promise<void> {
  await c.tx.table('group_membership_log').put({ id: c.env.uuid(), groupId, userId, kind, at: c.now });
}

/** The animals as they stood at `at`: later arrivals out, later departures still active (Step 8.6). */
function animalsAt(animals: readonly PlacedAnimal[], at: number): PlacedAnimal[] {
  return animals.filter((a) => a.acquiredAt < at).map((a) => (a.status !== 'active' && a.endedAt !== null && a.endedAt >= at ? { ...a, status: 'active', endedAt: null, endReason: null } : a));
}

/** A member's island score in a group week at `at` (shared rule, Step 8.3). */
export async function memberScore(tx: Tx, userId: string, group: Pick<GroupRow, 'week' | 'timezone'>, at: number): Promise<ScoreView> {
  const { start, end } = weekRange(group.week, group.timezone);
  const animals = (await tx.table('animals').find({ userId })).map(strip);
  return islandScore(animalsAt(animals, at), { weekStart: start, weekEnd: end, at });
}

/** Focus minutes of a member in [start, end): verified, completed (information only in the ranking). */
async function focusMinutes(tx: Tx, userId: string, start: number, end: number): Promise<number> {
  const sessions = await tx.table('sessions').find({ userId, status: 'completed' });
  return sessions.filter((s) => s.endedAt !== undefined && s.endedAt >= start && s.endedAt < end).reduce((sum, s) => sum + sessionMissionMinutes(s), 0);
}

/** Competition ranks (ties share a rank: 1, 1, 3). */
function ranks(scores: number[]): number[] {
  return scores.map((s) => 1 + scores.filter((o) => o > s).length);
}

export async function missionWeek(c: GroupCtx, group: GroupRow, week: string): Promise<MissionWeekRow> {
  const key = `${group.id}|${week}`;
  const found = await c.tx.table('group_mission_weeks').get(key);
  if (found) return found;
  const memberCount = (await membersOf(c.tx, group.id)).length;
  const row: MissionWeekRow = { key, groupId: group.id, weekStart: week, kind: 'focusMinutes', memberCount, targetMinutes: missionTarget(memberCount), progressMinutes: 0, milestonesReached: [], balanceVersion: BALANCE_VERSION };
  await c.tx.table('group_mission_weeks').put(row);
  return row;
}

/**
 * Weekly settlement (Step 8.6) of every week of `group` whose end has passed, oldest first. Idempotent:
 * results are keyed by group, week and user; gold by a deterministic ledger id. Runs from the job and
 * lazily from group reads, so a missed job never loses a week.
 */
export async function settleDueWeeks(c: GroupCtx, start: GroupRow): Promise<GroupRow> {
  let group = start;
  while (weekOf(c.now, group.timezone) > group.week) group = await settleWeek(c, group);
  return group;
}

async function settleWeek(c: GroupCtx, group: GroupRow): Promise<GroupRow> {
  const week = group.week;
  const { start, end } = weekRange(week, group.timezone);
  const next = nextWeek(week);
  const members = await membersOf(c.tx, group.id);
  const rows: { m: GroupMemberRow; score: number; focus: number; eligible: boolean }[] = [];
  for (const m of members) {
    const w = await c.writerFor(m.userId);
    await settleExpirations({ tx: c.tx, now: c.now, env: c.env }, w);
    const score = (await memberScore(c.tx, m.userId, group, end)).score;
    rows.push({ m, score, focus: await focusMinutes(c.tx, m.userId, start, end), eligible: m.joinedAt <= start });
  }
  const eligible = rows.filter((r) => r.eligible);
  const top = Math.max(0, ...eligible.map((r) => r.score));
  const winners = eligible.length >= balance.social.minMembersForReward && top > 0 ? eligible.filter((r) => r.score === top).map((r) => r.m.userId) : [];
  const rank = ranks(rows.map((r) => r.score));
  for (const [i, r] of rows.entries()) {
    const key = `${group.id}|${week}|${r.m.userId}`;
    if (await c.tx.table('weekly_results').get(key)) continue;
    const won = winners.includes(r.m.userId);
    await c.tx.table('weekly_results').put({ key, groupId: group.id, weekStart: week, userId: r.m.userId, score: r.score, focusMinutes: r.focus, rank: rank[i]!, eligible: r.eligible, rewarded: won, balanceVersion: BALANCE_VERSION });
    const w = await c.writerFor(r.m.userId);
    const gold = won ? balance.social.weeklyWinnerGold : 0;
    if (won && !(await c.tx.table('ledger').get(`weekly|${key}`))) await w.insert('ledger', { id: `weekly|${key}`, at: c.now, currency: 'gold', amount: gold, reason: LEDGER_REASON.weekly, refId: group.id });
    // The champion flag flies for the new week on the winners' islands only.
    // (A winner has animals, so an island.)
    const island = await c.tx.table('island_state').get(r.m.userId);
    if (island && (won || island.championWeek)) {
      const { championWeek: _old, ...rest } = strip(island);
      await w.put('island_state', won ? { ...rest, championWeek: next } : rest);
    }
    await notify(w, c.env.uuid(), c.now, { kind: 'weekly_result', groupId: group.id, weekStart: week, winnerIds: winners, youWon: won, gold });
  }
  const settled: GroupRow = { ...group, week: next, championIds: winners, championWeek: week };
  await c.tx.table('groups').put(settled);
  await missionWeek(c, settled, next);
  return settled;
}

/** Step 8.5: a completed verified session adds its minutes; milestones pay contributors once each. */
async function countForMission(c: HandlerCtx, session: FocusSession): Promise<void> {
  const m = await membership(c.tx, c.userId);
  const minutes = sessionMissionMinutes(session);
  if (!m || minutes <= 0) return;
  const found = await c.tx.table('groups').get(m.groupId);
  if (!found) return;
  const group = await settleDueWeeks(c, found);
  if (weekOf(session.endedAt!, group.timezone) !== group.week) return; // ended in a week already settled
  const mission = await missionWeek(c, group, group.week);
  const ckey = `${group.id}|${group.week}|${c.userId}`;
  const mine = await c.tx.table('group_mission_contributions').get(ckey);
  await c.tx.table('group_mission_contributions').put({ key: ckey, groupId: group.id, weekStart: group.week, userId: c.userId, minutes: (mine?.minutes ?? 0) + minutes });
  const before = mission.progressMinutes;
  const after = before + minutes;
  const crossed = milestonesCrossed(before, after, mission.targetMinutes).filter((i) => !mission.milestonesReached.includes(i));
  await c.tx.table('group_mission_weeks').put({ ...mission, progressMinutes: after, milestonesReached: [...mission.milestonesReached, ...crossed] });
  if (!crossed.length) return;
  const current = new Set((await membersOf(c.tx, group.id)).map((x) => x.userId));
  const contributors = (await c.tx.table('group_mission_contributions').find({ groupId: group.id, weekStart: group.week })).filter((x) => current.has(x.userId) && earnsMilestoneGold(x.minutes));
  for (const i of crossed) {
    const gold = balance.missions.milestoneGold[i] ?? 0;
    for (const x of contributors) {
      const id = `mission|${group.id}|${group.week}|${i}|${x.userId}`;
      if (await c.tx.table('ledger').get(id)) continue;
      const w = await c.writerFor(x.userId);
      await w.insert('ledger', { id, at: c.now, currency: 'gold', amount: gold, reason: LEDGER_REASON.mission, refId: group.id });
      await notify(w, c.env.uuid(), c.now, { kind: 'mission_milestone', groupId: group.id, weekStart: group.week, milestone: i, gold });
    }
  }
}
afterSessionCompleted.push(countForMission);

/** A deleted account leaves its group; an owner's group passes to the longest member, or closes. */
beforeAccountDelete.push(async (c) => {
  for (const inv of await c.tx.table('group_invites').find({ inviteeId: c.userId })) await c.tx.table('group_invites').delete(inv.id);
  const m = await membership(c.tx, c.userId);
  if (!m) return;
  await c.tx.table('group_members').delete(c.userId);
  const group = await c.tx.table('groups').get(m.groupId);
  if (!group || group.ownerId !== c.userId) return;
  const [heir] = await membersOf(c.tx, group.id);
  if (!heir) {
    await c.tx.table('groups').delete(group.id);
    return;
  }
  await c.tx.table('groups').put({ ...group, ownerId: heir.userId });
  await c.tx.table('group_members').put({ ...heir, role: 'owner' });
});

/** The Group tab's data for one viewer (Steps 8.2, 8.4, 8.5). */
export async function groupView(tx: Tx, group: GroupRow, viewerId: string, now: number): Promise<GroupView> {
  const { start, end } = weekRange(group.week, group.timezone);
  const members = await membersOf(tx, group.id);
  const scored: Omit<MemberView, 'rank'>[] = [];
  for (const m of members) {
    scored.push({
      person: await personView(tx, viewerId, m.userId, now, true),
      role: m.role,
      joinedAt: m.joinedAt,
      score: await memberScore(tx, m.userId, group, now),
      weekFocusMinutes: await focusMinutes(tx, m.userId, start, end),
      champion: group.championIds.includes(m.userId),
    });
  }
  const rank = ranks(scored.map((s) => s.score.score));
  const ranked = scored.map((s, i) => ({ ...s, rank: rank[i]! })).sort((a, b) => a.rank - b.rank || a.joinedAt - b.joinedAt);
  const mission = (await tx.table('group_mission_weeks').get(`${group.id}|${group.week}`)) ?? {
    memberCount: members.length,
    targetMinutes: missionTarget(members.length),
    progressMinutes: 0,
    milestonesReached: [] as number[],
  };
  const contributions = (await tx.table('group_mission_contributions').find({ groupId: group.id, weekStart: group.week })).sort((a, b) => b.minutes - a.minutes);
  return {
    id: group.id,
    name: group.name,
    ownerId: group.ownerId,
    timezone: group.timezone,
    warEnabled: group.warEnabled,
    inviteCode: group.inviteCode,
    inviteCodeEnabled: group.inviteCodeEnabled,
    week: { start: group.week, endsAt: end },
    members: ranked,
    mission: {
      kind: 'focusMinutes',
      weekStart: group.week,
      memberCount: mission.memberCount,
      targetMinutes: mission.targetMinutes,
      progressMinutes: mission.progressMinutes,
      milestones: milestoneMinutes(mission.targetMinutes).map((minutes, i) => ({ minutes, gold: balance.missions.milestoneGold[i] ?? 0, reached: mission.milestonesReached.includes(i) })),
      contributions: await Promise.all(contributions.map(async (x) => ({ person: await personView(tx, viewerId, x.userId, now, false), minutes: x.minutes }))),
    },
  };
}

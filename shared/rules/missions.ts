import { balance } from '../balance/balance';
import type { FocusSession } from '../types/rows';

/**
 * Cooperative group missions (guidance_v2 Step 8.5). One per group per ranking week; the type is data
 * (`focusMinutes` today) so other kinds (`sessions`, `togetherSessions`, `speciesFound`) can be added.
 */
export type MissionKind = 'focusMinutes';
type Missions = typeof balance.missions;

/** `round(perMemberMinutes × n × sizeFactor[n])`, with `n` = members at week start (frozen for the week). */
export function missionTarget(members: number, cfg: Missions = balance.missions): number {
  const n = Math.max(2, Math.min(10, Math.round(members)));
  return Math.round(cfg.perMemberMinutes * n * (cfg.sizeFactor[n] ?? 1));
}

/** Minutes needed for each milestone (50 / 100 / 150 % of the target by default). */
export const milestoneMinutes = (target: number, cfg: Missions = balance.missions): number[] => cfg.milestones.map((m) => Math.round(target * m));

/** Milestones (indices) crossed when progress goes from `before` to `after`: each exactly once. */
export function milestonesCrossed(before: number, after: number, target: number, cfg: Missions = balance.missions): number[] {
  return milestoneMinutes(target, cfg).flatMap((need, i) => (before < need && after >= need ? [i] : []));
}

/** What a session adds: verified completed focus, its real minutes (as Stats count it, Step 1.2). */
export function sessionMissionMinutes(s: Pick<FocusSession, 'status' | 'verified' | 'startedAt' | 'endedAt'>): number {
  if (s.status !== 'completed' || !s.verified || s.endedAt === undefined) return 0;
  return Math.max(0, s.endedAt - s.startedAt) / 60_000;
}

/** Members who contributed enough this week get milestone gold. */
export const earnsMilestoneGold = (contributionMinutes: number, cfg: Missions = balance.missions): boolean => contributionMinutes >= cfg.minContributionMinutes;

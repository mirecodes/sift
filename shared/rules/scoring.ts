import { balance } from '../balance/balance';
import type { PlacedAnimal } from '../types/rows';

/**
 * Island score (guidance_v2 Step 8.3, owner decision rev 2): what the user has now, not gold or time.
 *   active verified animals            → full points (tier points + species bonus)
 *   verified animals lost in war       → `vanishedWeight` × points, inside the window
 *   departed, spent, unverified        → 0
 * Scores may be fractional: compare exactly, show at most one decimal.
 */
type Scoring = typeof balance.scoring;
type Scored = Pick<PlacedAnimal, 'speciesId' | 'tierRank' | 'status' | 'endReason' | 'endedAt' | 'verified' | 'acquiredAt'>;

export const animalPoints = (a: Pick<Scored, 'speciesId' | 'tierRank'>, cfg: Scoring = balance.scoring): number => (cfg.tierPoints[a.tierRank] ?? 0) + (cfg.speciesBonus[a.speciesId] ?? 0);

export interface ScoreBreakdown {
  score: number;
  /** Active animals by tier rank (counts) and their points. */
  activeByTier: number[];
  activePoints: number;
  /** Animals lost in battle inside the window (counted at `vanishedWeight`). */
  lostInBattle: number;
  lostPoints: number;
}

/**
 * The score at `at` of a ranking week [`weekStart`, `weekEnd`) (UTC instants of the group's week).
 * `untilNaturalExpiry` counts a war loss until the animal would have left on its own.
 */
export function islandScore(animals: readonly Scored[], week: { weekStart: number; weekEnd: number; at: number }, cfg: Scoring = balance.scoring): ScoreBreakdown {
  const out: ScoreBreakdown = { score: 0, activeByTier: [0, 0, 0, 0], activePoints: 0, lostInBattle: 0, lostPoints: 0 };
  const lifetime = balance.economy.animalLifetimeDays * 86_400_000;
  for (const a of animals) {
    if (!a.verified) continue;
    if (a.status === 'active') {
      out.activeByTier[a.tierRank] = (out.activeByTier[a.tierRank] ?? 0) + 1;
      out.activePoints += animalPoints(a, cfg);
    } else if (a.status === 'vanished' && a.endReason === 'war' && a.endedAt !== null && a.endedAt <= week.at) {
      const inWindow = cfg.vanishedWindow === 'rankingWeek' ? a.endedAt >= week.weekStart && a.endedAt < week.weekEnd : week.at < a.acquiredAt + lifetime;
      if (!inWindow) continue;
      out.lostInBattle += 1;
      out.lostPoints += cfg.vanishedWeight * animalPoints(a, cfg);
    }
  }
  out.score = out.activePoints + out.lostPoints;
  return out;
}

/** `12`, `12.5` (one decimal at most). */
export const formatScore = (score: number): string => String(Math.round(score * 10) / 10);

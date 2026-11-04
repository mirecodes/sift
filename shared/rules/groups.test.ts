import { describe, expect, it } from 'vitest';
import { balance } from '../balance/balance';
import type { PlacedAnimal } from '../types/rows';
import { earnsMilestoneGold, milestonesCrossed, missionTarget, sessionMissionMinutes } from './missions';
import { animalPoints, formatScore, islandScore } from './scoring';
import { isTimeZone, localMidnight, nextWeek, weekOf, weekRange } from './week';

const DAY = 86_400_000;
const a = (over: Partial<PlacedAnimal>): PlacedAnimal => ({
  id: 'x', speciesId: 'fox', tier: 'common', tierRank: 0, tileX: 0, tileZ: 0, acquiredAt: 0, sessionId: 's',
  status: 'active', endedAt: null, endReason: null, verified: true, pinned: false, ...over,
});

describe('ranking weeks', () => {
  it('start on Monday 00:00 in the group time zone', () => {
    // Sunday 2026-10-25 20:00 UTC is already Monday 05:00 in Seoul.
    const t = Date.UTC(2026, 9, 25, 20);
    expect(weekOf(t, 'Asia/Seoul')).toBe('2026-10-26');
    expect(weekOf(t, 'UTC')).toBe('2026-10-19');
    expect(weekOf(t, 'America/Los_Angeles')).toBe('2026-10-19');
    expect(localMidnight('2026-10-26', 'Asia/Seoul')).toBe(Date.UTC(2026, 9, 25, 15));
    const { start, end } = weekRange('2026-10-26', 'Asia/Seoul');
    expect(end - start).toBe(7 * DAY);
    expect(nextWeek('2026-10-26')).toBe('2026-11-02');
  });

  it('handle daylight saving (a 167-hour week in Berlin)', () => {
    const { start, end } = weekRange('2026-10-19', 'Europe/Berlin'); // clocks go back on 25 Oct
    expect(end - start).toBe(7 * DAY + 3_600_000);
    expect(weekOf(start, 'Europe/Berlin')).toBe('2026-10-19');
    expect(weekOf(end - 1, 'Europe/Berlin')).toBe('2026-10-19');
    expect(weekOf(end, 'Europe/Berlin')).toBe('2026-10-26');
  });

  it('knows real time zones', () => {
    expect(isTimeZone('Asia/Seoul')).toBe(true);
    expect(isTimeZone('Mars/Base')).toBe(false);
  });
});

describe('island score (Step 8.3)', () => {
  const week = { weekStart: 10 * DAY, weekEnd: 17 * DAY, at: 12 * DAY };

  it('counts active verified animals by tier points', () => {
    const s = islandScore([a({ tierRank: 0 }), a({ tierRank: 3 }), a({ tierRank: 2 })], week);
    expect(s).toMatchObject({ score: 1 + 30 + 10, activeByTier: [1, 0, 1, 1], lostInBattle: 0 });
  });

  it('excludes departed, spent and unverified animals', () => {
    expect(islandScore([a({ status: 'departed', endReason: 'expired', endedAt: 11 * DAY }), a({ status: 'spent', endReason: 'island_move', endedAt: 11 * DAY }), a({ verified: false })], week).score).toBe(0);
  });

  it('counts war losses at 50% inside the ranking week, 0 after the boundary', () => {
    const lost = a({ tierRank: 1, status: 'vanished', endReason: 'war', endedAt: 11 * DAY });
    expect(islandScore([lost], week)).toMatchObject({ score: 1.5, lostInBattle: 1, lostPoints: 1.5 });
    expect(islandScore([lost], { weekStart: 17 * DAY, weekEnd: 24 * DAY, at: 18 * DAY }).score).toBe(0);
    expect(islandScore([{ ...lost, endedAt: 9 * DAY }], week).score).toBe(0);
  });

  it('can count war losses until the animal would have left on its own', () => {
    const cfg = { ...balance.scoring, vanishedWindow: 'untilNaturalExpiry' as const };
    const lost = a({ tierRank: 2, status: 'vanished', endReason: 'war', endedAt: 11 * DAY, acquiredAt: 9 * DAY });
    expect(islandScore([lost], { weekStart: 17 * DAY, weekEnd: 24 * DAY, at: 15 * DAY }, cfg).score).toBe(5);
    expect(islandScore([lost], { weekStart: 17 * DAY, weekEnd: 24 * DAY, at: 16 * DAY + 1 }, cfg).score).toBe(0);
  });

  it('adds species bonuses and formats one decimal', () => {
    expect(animalPoints({ speciesId: 'fox', tierRank: 0 }, { ...balance.scoring, speciesBonus: { fox: 2 } })).toBe(3);
    expect(formatScore(12.25)).toBe('12.3');
    expect(formatScore(41)).toBe('41');
  });
});

describe('group missions (Step 8.5)', () => {
  it('scales the target with the group size (§8 table)', () => {
    const hours = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => missionTarget(n) / 60);
    expect(hours.map((h) => Math.round(h * 10) / 10)).toEqual([10, 14.3, 18, 21.3, 25.5, 28, 32, 33.8, 37.5]);
  });

  it('crosses each milestone exactly once, two in one session too', () => {
    const target = missionTarget(2); // 600
    expect(milestonesCrossed(0, 299, target)).toEqual([]);
    expect(milestonesCrossed(299, 300, target)).toEqual([0]);
    expect(milestonesCrossed(300, 400, target)).toEqual([]);
    expect(milestonesCrossed(290, 610, target)).toEqual([0, 1]);
    expect(milestonesCrossed(610, 900, target)).toEqual([2]);
  });

  it('counts verified completed minutes and the contribution threshold', () => {
    expect(sessionMissionMinutes({ status: 'completed', verified: true, startedAt: 0, endedAt: 30 * 60_000 })).toBe(30);
    expect(sessionMissionMinutes({ status: 'completed', verified: false, startedAt: 0, endedAt: 30 * 60_000 })).toBe(0);
    expect(sessionMissionMinutes({ status: 'abandoned', verified: true, startedAt: 0, endedAt: 30 * 60_000 })).toBe(0);
    expect(earnsMilestoneGold(24.9)).toBe(false);
    expect(earnsMilestoneGold(25)).toBe(true);
  });
});

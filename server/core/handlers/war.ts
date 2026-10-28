import type { ErrorCode, WarFighter, WarPreview, WarSummary, WarView } from '../../../shared/api/types';
import { BALANCE_VERSION, balance } from '../../../shared/balance/balance';
import { attackArmy, defenseArmy, landingFormation, lootFor, simulateBattle } from '../../../shared/rules/war';
import { weekRange } from '../../../shared/rules/week';
import type { PlacedAnimal } from '../../../shared/types/rows';
import { skinForAnimal } from '../../../src/domain/cosmetics/inventory';
import { LEDGER_REASON } from '../../../src/domain/economy/ledger';
import { islandSide } from '../../../src/domain/island/island';
import { ApiError, type HandlerCtx } from '../context';
import type { Tx } from '../db';
import { membership, settleDueWeeks } from '../groups';
import type { GroupRow, WarRow } from '../schema';
import { islandSnapshot, personView, requireHandle } from '../social';
import { notify, settleExpirations, strip, userState } from '../user';
import type { Handlers } from './core';

const HOUR = 3_600_000;
const MIN = 60_000;

const byTier = (animals: readonly PlacedAnimal[]) => [0, 1, 2, 3].map((r) => animals.filter((a) => a.tierRank === r).length);

/** The caller's group and the target's membership in it (Step 9.1: only inside a group, war on). */
async function battlefield(c: HandlerCtx, targetId: string): Promise<GroupRow> {
  await requireHandle(c);
  if (targetId === c.userId) throw new ApiError('invalid');
  const mine = await membership(c.tx, c.userId);
  const theirs = await membership(c.tx, targetId);
  if (!mine) throw new ApiError('not_in_group');
  if (!theirs || theirs.groupId !== mine.groupId) throw new ApiError('not_in_group');
  const found = await c.tx.table('groups').get(mine.groupId);
  if (!found) throw new ApiError('not_in_group');
  const group = await settleDueWeeks(c, found);
  if (!group.warEnabled) throw new ApiError('war_disabled');
  return group;
}

/** Why an attack cannot start now (Step 9.5 checks), with the time it can. */
async function blocker(c: HandlerCtx, group: GroupRow, targetId: string): Promise<{ code: ErrorCode; until?: number } | null> {
  const { end } = weekRange(group.week, group.timezone);
  if (end - c.now <= balance.war.freezeBeforeSettlementMinutes * MIN) return { code: 'settlement_freeze', until: end };
  const mine = (await c.tx.table('wars').find({ attackerId: c.userId })).reduce((t, w) => Math.max(t, w.createdAt), 0);
  if (mine && c.now < mine + balance.war.attackerCooldownHours * HOUR) return { code: 'cooldown_active', until: mine + balance.war.attackerCooldownHours * HOUR };
  const hit = (await c.tx.table('wars').find({ defenderId: targetId })).reduce((t, w) => Math.max(t, w.createdAt), 0);
  if (hit && c.now < hit + balance.war.defenderShieldHours * HOUR) return { code: 'shield_active', until: hit + balance.war.defenderShieldHours * HOUR };
  const joined = (await c.tx.table('profiles').get(targetId))?.joinedGroupAt ?? 0;
  if (c.now < joined + balance.war.newMemberProtectionHours * HOUR) return { code: 'protected_new_member', until: joined + balance.war.newMemberProtectionHours * HOUR };
  return null;
}

/** Gold a defender already lost to wars this ranking week (for the optional weekly cap). */
async function lostThisWeek(tx: Tx, defenderId: string, group: GroupRow): Promise<number> {
  const { start } = weekRange(group.week, group.timezone);
  return (await tx.table('wars').find({ defenderId })).filter((w) => w.createdAt >= start).reduce((s, w) => s + w.lootGold, 0);
}

async function warView(c: HandlerCtx, row: WarRow): Promise<WarView> {
  const { attackerId, defenderId, ...rest } = row;
  return { ...rest, attacker: await personView(c.tx, c.userId, attackerId, c.now, false), defender: await personView(c.tx, c.userId, defenderId, c.now, false) };
}

const fighter = (a: PlacedAnimal, skinId: string): Omit<WarFighter, 'x' | 'z'> => ({ id: a.id, speciesId: a.speciesId, tierRank: a.tierRank, ...(skinId !== 'default' && { skinId }) });

/** Phase 9 operations (guidance_v2 Steps 9.5–9.8). */
export const warHandlers: Handlers = {
  async war_preview(c, args) {
    const group = await battlefield(c, args.targetId);
    const [me, them] = await Promise.all([userState(c.tx, c.userId), userState(c.tx, args.targetId)]);
    const attackers = attackArmy(me.animals);
    const defenders = defenseArmy(them.animals);
    const preview: WarPreview = {
      attackers: byTier(attackers),
      unicornsHome: me.animals.filter((a) => a.status === 'active' && a.verified && (balance.war.attackExcludedSpecies as readonly string[]).includes(a.speciesId)).length,
      defenders: byTier(defenders),
      defenderUnicorns: defenders.filter((a) => a.speciesId === 'unicorn').length,
      lootIfWin: lootFor(them.gold, await lostThisWeek(c.tx, args.targetId, group)),
      blocked: (await blocker(c, group, args.targetId)) ?? (attackers.length ? null : { code: 'no_army' }),
    };
    return { preview };
  },

  /**
   * Step 9.5: both users locked and settled, armies built (attacker Unicorns stay home), a random seed,
   * the shared simulation, then one write: vanished animals, loot, the war row, notices, cooldown and
   * shield (derived from the row). The defender is pushed unless they focus.
   */
  async declare_war(c, args) {
    const group = await battlefield(c, args.targetId);
    const blocked = await blocker(c, group, args.targetId);
    if (blocked) throw new ApiError(blocked.code);
    const defenderW = await c.writerFor(args.targetId);
    await settleExpirations(c, c.w);
    await settleExpirations(c, defenderW);
    const [me, them] = await Promise.all([userState(c.tx, c.userId), userState(c.tx, args.targetId)]);
    const attackers = attackArmy(me.animals);
    if (!attackers.length) throw new ApiError('no_army');
    const defenders = defenseArmy(them.animals);
    const island = await islandSnapshot(c.tx, args.targetId);
    const half = (islandSide(island.level) - 1) / 2;
    const formation = landingFormation(attackers.map((a) => fighter(a, skinForAnimal(a, me.equipped))), half);
    const defense: WarFighter[] = defenders.map((a) => ({ ...fighter(a, skinForAnimal(a, them.equipped)), x: a.tileX, z: a.tileZ }));
    const seed = Math.floor(c.env.random() * 2 ** 31);
    const battle = simulateBattle(formation, defense, seed);
    const loot = battle.winner === 'attacker' ? lootFor(them.gold, await lostThisWeek(c.tx, args.targetId, group)) : 0;
    const id = c.env.uuid();

    const vanished = new Set(battle.vanished);
    for (const a of [...attackers, ...defenders]) {
      if (!vanished.has(a.id)) continue;
      const w = attackers.includes(a) ? c.w : defenderW;
      const stored = await c.tx.table('animals').get(a.id);
      if (stored) await w.put('animals', { ...strip(stored), status: 'vanished', endedAt: c.now, endReason: 'war' });
    }
    if (loot > 0) {
      await defenderW.insert('ledger', { id: `war-lost|${id}`, at: c.now, currency: 'gold', amount: -loot, reason: LEDGER_REASON.warLost, refId: id });
      await c.w.insert('ledger', { id: `war|${id}`, at: c.now, currency: 'gold', amount: loot, reason: LEDGER_REASON.war, refId: id });
    }
    const row: WarRow = {
      id,
      groupId: group.id,
      createdAt: c.now,
      attackerId: c.userId,
      defenderId: args.targetId,
      island: { world: island.world, level: island.level, buildings: island.buildings, equipped: island.equipped, goldPileLevel: island.goldPileLevel },
      attackers: formation,
      defenders: defense,
      rounds: battle.rounds,
      winner: battle.winner,
      fallen: battle.fallen,
      vanished: battle.vanished,
      protected: battle.protected,
      lootGold: loot,
      seed,
      balanceVersion: BALANCE_VERSION,
    };
    await c.tx.table('wars').insert(row);
    const lostBy = (ids: readonly { id: string }[]) => ids.filter((a) => vanished.has(a.id)).length;
    const attackerWon = battle.winner === 'attacker';
    await notify(c.w, c.env.uuid(), c.now, { kind: 'war_report', warId: id, role: 'attacker', result: attackerWon ? 'win' : 'loss', opponentId: args.targetId, vanished: lostBy(attackers), gold: loot, at: c.now });
    await notify(defenderW, c.env.uuid(), c.now, { kind: 'war_report', warId: id, role: 'defender', result: attackerWon ? 'loss' : 'win', opponentId: c.userId, vanished: lostBy(defenders), gold: -loot, at: c.now });
    return { war: await warView(c, row) };
  },

  async war_list(c) {
    const m = await membership(c.tx, c.userId);
    if (!m) return { wars: [] };
    const rows = [...(await c.tx.table('wars').find({ attackerId: c.userId })), ...(await c.tx.table('wars').find({ defenderId: c.userId }))]
      .filter((w) => w.groupId === m.groupId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
    const wars: WarSummary[] = [];
    for (const w of rows) {
      const role = w.attackerId === c.userId ? 'attacker' : 'defender';
      const mine = new Set((role === 'attacker' ? w.attackers : w.defenders).map((f) => f.id));
      wars.push({
        id: w.id,
        createdAt: w.createdAt,
        role,
        opponent: await personView(c.tx, c.userId, role === 'attacker' ? w.defenderId : w.attackerId, c.now, false),
        won: (w.winner === 'attacker') === (role === 'attacker'),
        lost: w.vanished.filter((id) => mine.has(id)).length,
        gold: role === 'attacker' ? w.lootGold : -w.lootGold,
      });
    }
    return { wars };
  },

  async get_war(c, args) {
    const row = await c.tx.table('wars').get(args.warId);
    if (!row) throw new ApiError('not_found');
    const participant = row.attackerId === c.userId || row.defenderId === c.userId;
    if (!participant && (await membership(c.tx, c.userId))?.groupId !== row.groupId) throw new ApiError('not_found');
    return { war: await warView(c, row) };
  },
};

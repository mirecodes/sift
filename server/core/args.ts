import { z } from 'zod';
import type { Op } from '../../shared/api/types';

/**
 * Argument schemas: the server never trusts a client's shapes. Unknown fields are dropped; wrong ones
 * answer `invalid`. Row schemas are deliberately loose about extra fields (older and newer clients).
 */
const id = z.string().min(1).max(80);
const int = z.number().int();
const time = z.number().int().min(0);
const rotation = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);

const equipped = z.object({ skinsBySpecies: z.record(z.string(), z.array(z.string()).max(64)), blockThemeId: z.string() });
const building = z.object({ id, defId: id, tileX: int, tileZ: int, rotation, placedAt: time });
const session = z.object({
  id,
  startedAt: time,
  plannedFocusMs: time,
  endedAt: time.optional(),
  effectiveFocusMs: time.optional(),
  status: z.enum(['running', 'completed', 'abandoned']),
  rewardAnimalId: id.optional(),
  togetherRoomId: z.string().nullable().default(null),
});
const animal = z.object({
  id,
  speciesId: id,
  tier: z.enum(['common', 'mythic', 'epic', 'legendary']),
  tierRank: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  tileX: int,
  tileZ: int,
  acquiredAt: time,
  sessionId: z.string(),
  status: z.enum(['active', 'departed', 'vanished', 'spent']),
  endedAt: time.nullable(),
  endReason: z.enum(['expired', 'war', 'island_move']).nullable(),
  verified: z.boolean(),
  pinned: z.boolean(),
  skinId: z.string().optional(),
});
const ledger = z.object({ id, at: time, currency: z.literal('gold'), amount: int, reason: z.string().max(40), refId: z.string().nullable() });
const cosmetic = z.object({ id, kind: z.enum(['animalSkin', 'blockTheme', 'building']), defId: id, acquiredAt: time, source: z.string().max(40) });
const history = z.object({ id, seed: int, from: time, to: time });

const MAX_ROWS = 20_000;

export const ARGS: { [O in Op]: z.ZodType } = {
  me: z.object({}),
  start_session: z.object({ sessionId: z.string().regex(/^[0-9a-zA-Z_-]{1,64}$/).optional(), plannedMs: time, roomId: z.string().nullable().optional(), force: z.boolean().optional() }),
  end_session: z.object({ sessionId: id, endedAt: time, status: z.enum(['completed', 'abandoned']) }),
  sync_pull: z.object({}),
  sync_push: z.object({
    ops: z
      .array(
        z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('equip'), equipped }),
          z.object({ kind: z.literal('dismiss_notice'), id }),
          z.object({ kind: z.literal('local_session'), session, animal: animal.nullable() }),
          z.object({ kind: z.literal('presence_setting'), showPresence: z.boolean() }),
        ]),
      )
      .max(200),
  }),
  purchase: z.object({ defId: id }),
  apply_layout: z.object({
    buildings: z.array(building).max(500),
    animals: z.array(z.object({ id, tileX: int, tileZ: int, pinned: z.boolean() })).max(2000).optional(),
  }),
  move_island: z.object({ seed: int.min(0).max(2 ** 31) }),
  get_content_manifest: z.object({ clientVersion: z.string().regex(/^\d+\.\d+\.\d+$/) }),
  upload_local_save: z.object({
    replace: z.boolean(),
    save: z.object({
      world: z.object({ seed: int, blockThemeId: z.string() }),
      animals: z.array(animal).max(MAX_ROWS),
      sessions: z.array(session).max(MAX_ROWS),
      ledger: z.array(ledger).max(MAX_ROWS),
      cosmetics: z.array(cosmetic).max(MAX_ROWS),
      equipped: equipped.optional(),
      placedBuildings: z.array(building).max(500),
      islandHistory: z.array(history).max(1000),
    }),
  }),
  export_account: z.object({}),
  delete_account: z.object({}),
  register_device: z.object({
    deviceId: id,
    platform: z.enum(['web', 'ios', 'android']),
    pushToken: z.string().max(4096).nullable(),
    appVersion: z.string().max(20),
    locale: z.string().max(20),
    categories: z.record(z.string(), z.boolean()).optional(),
  }),
  social_state: z.object({}),
  set_handle: z.object({ name: z.string().max(64) }),
  friend_request: z.object({ name: z.string().max(64), tag: z.string().regex(/^\d{4}$/) }),
  friend_respond: z.object({ userId: id, accept: z.boolean() }),
  friend_cancel: z.object({ userId: id }),
  friend_remove: z.object({ userId: id }),
  block_user: z.object({ userId: id }),
  unblock_user: z.object({ userId: id }),
  report_user: z.object({ userId: id, reason: z.enum(['name', 'harassment', 'cheating', 'other']), note: z.string().max(500).optional(), context: z.enum(['friends', 'group', 'visit']) }),
  get_island_snapshot: z.object({ userId: id }),
  together_create: z.object({ plannedMs: time, invitees: z.array(id).min(1).max(20) }),
  together_room: z.object({ roomId: id }),
  together_join: z.object({ roomId: id }),
  together_leave: z.object({ roomId: id }),
  together_start: z.object({ roomId: id }),
};

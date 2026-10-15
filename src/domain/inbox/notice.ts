/** Things to tell the user later, never during Focus (guidance_v2 §2.9). */
export type Notice =
  | { kind: 'animals_departed'; animalIds: string[]; gold: number }
  | { kind: 'weekly_result'; groupId: string; weekStart: string; winnerIds: string[]; youWon: boolean; gold: number }
  | { kind: 'war_report'; warId: string; role: 'attacker' | 'defender'; result: 'win' | 'loss' }
  | { kind: 'joined_group' | 'removed_from_group'; groupId: string }
  | { kind: 'friend_request' | 'friend_accepted'; userId: string }
  | { kind: 'group_invite'; groupId: string; inviterId: string }
  | { kind: 'mission_milestone'; groupId: string; weekStart: string; milestone: number; gold: number }
  | { kind: 'together_invite'; roomId: string; hostId: string }
  | { kind: 'war_loot'; warId: string; gold: number /* + gained, - lost */ };

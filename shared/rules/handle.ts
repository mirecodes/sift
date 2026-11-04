/**
 * Handles `name#tag` (guidance_v2 Step 7.1). The same rule runs on the device (instant feedback) and on
 * the server (the decision); the server also applies its word filter (`server/core/moderation.ts`).
 *   name: 2–12 code points after NFC; complete Hangul syllables, Latin letters, digits; not digits only;
 *         not a reserved word.
 *   key:  NFC + Latin lower case: `Mina` and `mina` share a key, the display keeps the chosen case.
 *   tag:  4 digits `0001`–`9999`, assigned by the server.
 */
export interface Handle {
  name: string;
  tag: string;
}

export type HandleProblem = 'length' | 'chars' | 'digits_only' | 'reserved';

export const NAME_MIN = 2;
export const NAME_MAX = 12;

const ALLOWED = /^[가-힣A-Za-z0-9]+$/u;
const DIGITS = /^[0-9]+$/;
const TAG = /^(?!0000)\d{4}$/;

/** Words nobody may take as a name (case-insensitive, compared on the key). */
export const RESERVED_NAMES: readonly string[] = ['sift', 'admin', 'administrator', 'moderator', 'mod', 'official', 'support', 'staff', 'system', 'root', 'null', 'undefined', '운영자', '관리자', '운영진', '공식', '고객센터', '시프트'];

/** What the user typed, as it will be stored: NFC, outer spaces trimmed. */
export const normalizeName = (input: string): string => input.normalize('NFC').trim();

/** The uniqueness key: NFC and Latin lower case (Hangul has no case). */
export const handleKey = (name: string): string => normalizeName(name).replace(/[A-Z]/g, (c) => c.toLowerCase());

/** Why a name cannot be used, or null. */
export function nameProblem(input: string): HandleProblem | null {
  const name = normalizeName(input);
  const length = [...name].length;
  if (length < NAME_MIN || length > NAME_MAX) return 'length';
  if (!ALLOWED.test(name)) return 'chars';
  if (DIGITS.test(name)) return 'digits_only';
  if (RESERVED_NAMES.includes(handleKey(name))) return 'reserved';
  return null;
}

export const isTag = (tag: string): boolean => TAG.test(tag);

/** Group names (Step 8.1): 2–24 code points of letters, digits, spaces and simple punctuation. */
export function groupNameProblem(input: string): 'length' | 'chars' | null {
  const name = normalizeName(input).replace(/\s+/g, ' ');
  const length = [...name].length;
  if (length < 2 || length > 24) return 'length';
  return /^[\p{L}\p{N} .,'!?&()-]+$/u.test(name) && !/[ㄱ-ㆎ]/u.test(name) ? null : 'chars';
}

/** A group name as stored: NFC, inner spaces collapsed, trimmed. */
export const normalizeGroupName = (input: string): string => normalizeName(input).replace(/\s+/g, ' ');

/** `0001`–`9999` from a number 1–9999. */
export const formatTag = (n: number): string => String(n).padStart(4, '0');

/** `민지#4821`. */
export const formatHandle = (h: Handle): string => `${h.name}#${h.tag}`;

/** Reads `name#tag` as typed (spaces around it ignored, a full-width `＃` accepted); null if not a handle. */
export function parseHandle(input: string): Handle | null {
  const text = input.normalize('NFC').trim().replace('＃', '#');
  const hash = text.lastIndexOf('#');
  if (hash <= 0) return null;
  const name = text.slice(0, hash).trim();
  const tag = text.slice(hash + 1).trim();
  return nameProblem(name) === null && isTag(tag) ? { name, tag } : null;
}

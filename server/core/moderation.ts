import { handleKey } from '../../shared/rules/handle';

/**
 * Server-side word filter for handles and group names (guidance_v2 Step 7.2): Korean and English lists,
 * no URLs. Matching is on the normalized key with digits read as look-alike letters, so `f0ck` and `F*ck`
 * style tricks that survive the character rule are caught. The lists are deliberately short and live in
 * one place; extend them here (or move them to `app_config` later) without touching the rules.
 */
const BLOCKED: readonly string[] = [
  // English
  // (Short words that hide inside ordinary names, like `dick` in Dickens or `rape` in grape, are left out.)
  'fuck', 'shit', 'bitch', 'cunt', 'pussy', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard', 'nazi', 'hitler', 'porn',
  // Korean (`새끼` and `시바` are left out: 새끼고양이, 시바견)
  '시발', '씨발', '씨빨', '씹', '좆', '병신', '븅신', '개새', '미친놈', '미친년', '창녀', '걸레', '보지', '자지', '느금', '니애미', '섹스', '야동',
];

const LOOKALIKE: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's' };

const URL_LIKE = /(https?:|www\.|\.(com|net|org|kr|io|gg|me|app|xyz)\b|\/\/)/i;

/** True when a name may be shown to other people. */
export function nameAllowed(name: string): boolean {
  if (URL_LIKE.test(name)) return false;
  const key = handleKey(name);
  const plain = key.replace(/[0-9@$]/g, (c) => LOOKALIKE[c] ?? c).replace(/[^\p{L}]/gu, '');
  return !BLOCKED.some((w) => key.includes(w) || plain.includes(w));
}

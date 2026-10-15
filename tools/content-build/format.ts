/** `{ "a": 1, "b": { "c": 2 } }` on one line, spaced like the hand-written files. */
const inline = (v: unknown): string => JSON.stringify(v, null, 1).replace(/\n\s*/g, ' ');

/**
 * How content JSON files are written (Content Studio saves): an array puts one item per line, an
 * object is indented with two spaces. Always ends with a newline.
 */
export function formatContentJson(data: unknown): string {
  if (Array.isArray(data)) return `[\n${data.map((d) => `  ${inline(d)}`).join(',\n')}\n]\n`;
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** Content Studio may write only item files under `content/` (never models, presets or the pack version). */
export function isWritableContentPath(path: string): boolean {
  return /^(species|skins|skinFamilies|blockThemes|buildings|releases)\/[a-z0-9_-]+\.json$/.test(path);
}

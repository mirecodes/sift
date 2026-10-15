import { assemblePack, type ContentPack, type PackItem } from '../../../shared/content/pack';
import type { ContentDef } from '../../../shared/content/schema';
import { baselinePack, builtinModels, contentFiles, presetIds } from '../../domain/content/baseline';

/** One editable entry of a content file (Content Studio, Step 3.4). */
export interface SourceEntry {
  path: string;
  /** Position in an array file; null for a single-object file. */
  index: number | null;
  data: Record<string, unknown>;
}

export type Drafts = Readonly<Record<string, Record<string, unknown>>>;
const keyOf = (e: Pick<SourceEntry, 'path' | 'index'>) => `${e.path}#${e.index ?? ''}`;

/** Every entry of every item file, with unsaved drafts applied. */
export function sourceEntries(drafts: Drafts): SourceEntry[] {
  return contentFiles().flatMap(({ path, data }) => {
    const list = Array.isArray(data) ? data : [data];
    return list.map((d, i) => {
      const index = Array.isArray(data) ? i : null;
      return { path, index, data: drafts[keyOf({ path, index })] ?? (d as Record<string, unknown>) };
    });
  });
}

export const draftKey = keyOf;

/** The pack as it would be with the drafts saved, plus every problem. */
export function draftPack(drafts: Drafts, n: number): { pack: ContentPack; problems: string[]; entries: SourceEntry[] } {
  const entries = sourceEntries(drafts);
  const files = new Map<string, unknown[]>();
  for (const e of entries) files.set(e.path, [...(files.get(e.path) ?? []), e.data]);
  const isArray = new Set(entries.filter((e) => e.index !== null).map((e) => e.path));
  const { pack, problems } = assemblePack({
    // Newer than the baseline, so merging it into the registry wins.
    contentVersion: `${baselinePack.contentVersion}.${n}`,
    files: [...files].map(([path, list]) => ({ path, data: isArray.has(path) ? list : list[0] })),
    models: builtinModels(),
    presets: presetIds,
  });
  return { pack, problems, entries };
}

/** Which source entry an item comes from (expanded family skins come from the family file). */
export function entryFor(item: PackItem | ContentDef, entries: readonly SourceEntry[]): SourceEntry | undefined {
  const id = item.kind === 'animalSkin' && item.family ? item.family : item.id;
  return entries.find((e) => e.data.id === id);
}

/** Problems that name this item (by id or by its file position). */
export function problemsFor(id: string, entry: SourceEntry | undefined, problems: readonly string[]): string[] {
  const where = entry ? (entry.index === null ? entry.path : `${entry.path}[${entry.index}]`) : undefined;
  return problems.filter((p) => p.startsWith(`${id}:`) || p === `duplicate id ${id}` || (where !== undefined && p.startsWith(`${where}:`)));
}

export async function saveEntry(entry: SourceEntry, entries: readonly SourceEntry[]): Promise<void> {
  const siblings = entries.filter((e) => e.path === entry.path);
  const data = entry.index === null ? entry.data : siblings.map((e) => (e.index === entry.index ? entry.data : e.data));
  const res = await fetch('/__studio/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: entry.path, data }) });
  if (!res.ok) throw new Error(await res.text());
}

import { useEffect, useMemo, useState } from 'react';
import { balance } from '../../../shared/balance/balance';
import { expandFamily } from '../../../shared/content/pack';
import type { PaletteKey } from '../../../shared/content/palette';
import { SkinFamilyDef as SkinFamilySchema, type ContentDef, type SkinFamilyDef } from '../../../shared/content/schema';
import { CATALOG, getSpecies } from '../../domain/animals/catalog';
import { content } from '../../domain/content';
import { baselinePack, builtinModels } from '../../domain/content/baseline';
import { placementProblem } from '../../domain/build/placement';
import type { IslandAnimal, IslandModel } from '../../domain/island/model';
import { footprintTiles, getOccupancy, isFreeForAnimal, type Rotation } from '../../domain/island/occupancy';
import { generateIsland } from '../../domain/island/island';
import { Footprint } from '../../world/props/Footprint';
import { Scene } from '../../world/Scene';
import { clearContentGeometry } from '../../world/voxel/geometry';
import { VoxelSprite } from '../collection/VoxelSprite';
import { draftKey, draftPack, entryFor, problemsFor, saveEntry } from './studioData';
import styles from './Studio.module.css';

/**
 * Content Studio (guidance_v2 Step 3.4, development builds only, `/studio`): browse and filter every
 * item, preview it on a test island (day/night, any block theme, rotation, presets running), edit
 * skin families across all species, test building placement, and save edits back to `content/`.
 * Developer tool: English only, labels inline.
 */

const SEEDS = [11, 42, 2026];
const LEVEL = 20;
type Kind = ContentDef['kind'] | 'all';
const KINDS: Kind[] = ['all', 'species', 'animalSkin', 'skinFamily', 'blockTheme', 'building', 'release'];

interface ListItem {
  id: string;
  kind: ContentDef['kind'];
  label: string;
  release?: string;
  family?: string;
  def: ContentDef;
}

const nameOf = (d: ContentDef): string => d.name.en;

export function Studio() {
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [n, setN] = useState(1);
  const [selected, setSelected] = useState<string>(() => decodeURIComponent(location.hash.slice(1)) || 'golden');
  const [kind, setKind] = useState<Kind>('all');
  const [release, setRelease] = useState('');
  const [family, setFamily] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [noSprite, setNoSprite] = useState(false);
  const [query, setQuery] = useState('');
  const [seed, setSeed] = useState(SEEDS[0]!);
  const [dark, setDark] = useState(false);
  const [themeId, setThemeId] = useState('default');
  const [tile, setTile] = useState({ x: 1, z: 1 });
  const [rotation, setRotation] = useState<Rotation>(0);
  const [focusSpecies, setFocusSpecies] = useState<string>('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    history.replaceState(null, '', `#${encodeURIComponent(selected)}`);
  }, [selected]);
  useEffect(() => {
    const onHash = () => setSelected(decodeURIComponent(location.hash.slice(1)));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Drafts are merged into the live registry, so the world renders unsaved edits.
  const { pack, problems, entries } = useMemo(() => {
    const d = draftPack(drafts, n);
    content.merge(d.pack);
    clearContentGeometry();
    return d;
  }, [drafts, n]);

  const families = useMemo(
    () => entries.flatMap((e) => (e.data.kind === 'skinFamily' ? [SkinFamilySchema.safeParse(e.data)] : [])).flatMap((r) => (r.success ? [r.data] : [])),
    [entries],
  );
  const list = useMemo<ListItem[]>(() => {
    const items: ContentDef[] = [...pack.items, ...families];
    return items.map((d) => ({
      id: d.id,
      kind: d.kind,
      label: nameOf(d),
      ...('release' in d ? { release: d.release } : {}),
      ...(d.kind === 'animalSkin' && d.family ? { family: d.family } : d.kind === 'skinFamily' ? { family: d.id } : {}),
      def: d,
    }));
  }, [pack, families]);
  const releases = pack.items.filter((i) => i.kind === 'release').map((r) => r.id);
  const themes = pack.items.filter((i) => i.kind === 'blockTheme').map((t) => t.id);
  const frames = baselinePack.atlas?.frames ?? {};

  const visible = list.filter((i) =>
    (kind === 'all' || i.kind === kind) &&
    (!release || i.release === release) &&
    (!family || i.family === family) &&
    (!query || `${i.id} ${i.label}`.toLowerCase().includes(query.toLowerCase())) &&
    (!noSprite || (i.kind !== 'release' && i.kind !== 'skinFamily' && !frames[i.id])) &&
    (!onlyErrors || problemsFor(i.id, entryFor(i.def, entries), problems).length > 0),
  );
  const item = list.find((i) => i.id === selected) ?? list[0];
  const entry = item ? entryFor(item.def, entries) : undefined;
  const itemProblems = item ? problemsFor(item.id, entry, problems) : [];

  const edit = (patch: Record<string, unknown>) => {
    if (!entry) return;
    setDrafts((d) => ({ ...d, [draftKey(entry)]: { ...entry.data, ...patch } }));
    setN((x) => x + 1);
    setStatus('Unsaved changes');
  };
  const save = async () => {
    if (!entry) return;
    try {
      await saveEntry(entry, entries);
      setStatus(`Saved ${entry.path}`);
    } catch (e) {
      setStatus(`Save failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  // Preview island: the item on a sample terrain, a few tiles from the camp.
  // A new owner id per draft remounts the island, so edited skins and buildings are rebuilt.
  const preview = useMemo(() => ({ ...previewModel(item?.def, { seed, themeId, tile, rotation }), ownerId: `studio-${pack.contentVersion}` }), [item, seed, themeId, tile, rotation, pack]);
  const layout = useMemo(() => generateIsland(seed, LEVEL), [seed]);
  const heights = useMemo(() => new Map(layout.tiles.map((t) => [`${t.x},${t.z}`, t.top])), [layout]);
  const building = item?.def.kind === 'building' ? item.def : undefined;
  const fit = useMemo(() => {
    if (!building) return null;
    const grid = getOccupancy({ seed, islandLevel: LEVEL, animals: [], buildings: [] });
    return {
      tiles: footprintTiles(tile, building.footprint, rotation),
      problem: placementProblem(grid, { defId: building.id, tile, rotation, minFreeTiles: balance.build.minFreeTiles }),
    };
  }, [building, seed, tile, rotation]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (e.key === 'r' || e.key === 'R') setRotation((r) => (((r + 90) % 360) as Rotation));
      const step = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
      if (step && building) {
        e.preventDefault();
        setTile((t) => ({ x: t.x + step[0]!, z: t.z + step[1]! }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [building]);

  return (
    <div className={styles.root}>
      <Scene mode="home" islands={[{ model: preview, mode: 'own' }]} reducedMotion={false} theme={dark ? 'dark' : 'light'}>
        {fit && <Footprint tiles={fit.tiles} valid={fit.problem === null} heights={heights} />}
      </Scene>

      <aside className={styles.left}>
        <h1 className={styles.title}>Content Studio</h1>
        <p className={styles.small}>
          Pack {pack.contentVersion} · {pack.items.length} items · {problems.length ? <strong className={styles.error}>{problems.length} problems</strong> : 'valid'}
        </p>
        <input className={styles.input} placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className={styles.row}>
          <select className={styles.input} value={kind} onChange={(e) => setKind(e.target.value as Kind)} aria-label="Kind">
            {KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
          <select className={styles.input} value={release} onChange={(e) => setRelease(e.target.value)} aria-label="Release">
            <option value="">any release</option>
            {releases.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <select className={styles.input} value={family} onChange={(e) => setFamily(e.target.value)} aria-label="Family">
          <option value="">any family</option>
          {families.map((f) => <option key={f.id}>{f.id}</option>)}
        </select>
        <label className={styles.check}><input type="checkbox" checked={noSprite} onChange={(e) => setNoSprite(e.target.checked)} /> Missing sprite</label>
        <label className={styles.check}><input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} /> Validation errors</label>
        <ul className={styles.list}>
          {visible.map((i) => (
            <li key={`${i.kind}:${i.id}`}>
              <button type="button" className={i.id === item?.id ? styles.itemOn : styles.item} onClick={() => setSelected(i.id)}>
                <span>{i.label}</span>
                <span className={styles.small}>{i.kind} · {i.id}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className={styles.top}>
        <select className={styles.input} value={seed} onChange={(e) => setSeed(Number(e.target.value))} aria-label="Sample terrain">
          {SEEDS.map((s) => <option key={s} value={s}>terrain {s}</option>)}
        </select>
        <select className={styles.input} value={themeId} onChange={(e) => setThemeId(e.target.value)} aria-label="Block theme">
          {themes.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button type="button" className={styles.button} onClick={() => setDark((d) => !d)}>{dark ? 'Night' : 'Day'}</button>
        <span className={styles.small}>Drag to rotate · wheel to zoom</span>
      </section>

      <aside className={styles.right}>
        {item && entry ? (
          <>
            <h2 className={styles.title}>{item.label}</h2>
            <p className={styles.small}>{item.kind} · {item.id} · {entry.path}{entry.index !== null ? ` [${entry.index}]` : ''}</p>
            {itemProblems.map((p) => <p key={p} className={styles.error}>{p}</p>)}
            {problems.length > 0 && itemProblems.length === 0 && <details className={styles.small}><summary>{problems.length} problems elsewhere</summary>{problems.map((p) => <p key={p}>{p}</p>)}</details>}
            {item.kind === 'animalSkin' && item.family && item.family !== item.id ? (
              <p className={styles.small}>Generated by the <button type="button" className={styles.link} onClick={() => setSelected(item.family!)}>{item.family}</button> family: edit the family or its override for {getSpecies((item.def as { speciesId: string }).speciesId).name}.</p>
            ) : (
              <Fields data={entry.data} onChange={edit} releases={releases} />
            )}
            {item.kind === 'skinFamily' && (
              <FamilyEditor family={item.def as SkinFamilyDef} focus={focusSpecies} onFocus={setFocusSpecies} onChange={edit} />
            )}
            {building && fit && (
              <div className={styles.block}>
                <h3 className={styles.sub}>Building tester</h3>
                <p className={styles.small}>Tile ({tile.x}, {tile.z}) · {rotation}° · footprint {building.footprint.w}×{building.footprint.d}</p>
                <div className={styles.row}>
                  {(['←', '→', '↑', '↓'] as const).map((a, i) => (
                    <button key={a} type="button" className={styles.button} onClick={() => setTile((t) => ({ x: t.x + [-1, 1, 0, 0][i]!, z: t.z + [0, 0, -1, 1][i]! }))}>{a}</button>
                  ))}
                  <button type="button" className={styles.button} onClick={() => setRotation((r) => (((r + 90) % 360) as Rotation))}>Rotate (R)</button>
                </div>
                <p className={fit.problem ? styles.error : styles.ok}>{fit.problem ? `Cannot place: ${fit.problem}` : 'Fits here'}</p>
              </div>
            )}
            <div className={styles.row}>
              <button type="button" className={styles.primary} onClick={() => void save()} disabled={!drafts[draftKey(entry)]}>Save</button>
              <span className={styles.small}>{status}</span>
            </div>
          </>
        ) : (
          <p className={styles.small}>Nothing selected.</p>
        )}
      </aside>
    </div>
  );
}

/** Name, price, tags and availability of any item; release for everything that has one. */
function Fields({ data, onChange, releases }: { data: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void; releases: string[] }) {
  const name = (data.name ?? {}) as { en?: string; ko?: string };
  const text = (key: string, label: string, type = 'text') => (
    <label className={styles.field}>
      {label}
      <input
        className={styles.input}
        type={type}
        value={(data[key] as string | number | undefined) ?? ''}
        onChange={(e) => onChange({ [key]: e.target.value === '' ? undefined : type === 'number' ? Number(e.target.value) : e.target.value })}
      />
    </label>
  );
  const item = ['animalSkin', 'blockTheme', 'building'].includes(data.kind as string);
  return (
    <div className={styles.block}>
      <label className={styles.field}>Name (en)<input className={styles.input} value={name.en ?? ''} onChange={(e) => onChange({ name: { ...name, en: e.target.value } })} /></label>
      <label className={styles.field}>Name (ko)<input className={styles.input} value={name.ko ?? ''} onChange={(e) => onChange({ name: { ...name, ko: e.target.value } })} /></label>
      {'release' in data && (
        <label className={styles.field}>
          Release
          <select className={styles.input} value={data.release as string} onChange={(e) => onChange({ release: e.target.value })}>
            {releases.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
      )}
      {(item || data.kind === 'skinFamily') && (
        <>
          {item && text('price', 'Price', 'number')}
          <label className={styles.check}><input type="checkbox" checked={data.purchasable !== false} onChange={(e) => onChange({ purchasable: e.target.checked })} /> Purchasable</label>
          <label className={styles.field}>
            Tags (comma separated)
            <input className={styles.input} value={((data.tags as string[] | undefined) ?? []).join(', ')} onChange={(e) => onChange({ tags: e.target.value ? e.target.value.split(',').map((t) => t.trim()).filter(Boolean) : undefined })} />
          </label>
          {text('availableFrom', 'Available from (ISO date)')}
          {text('availableUntil', 'Available until (exclusive)')}
          {text('minClientVersion', 'Min app version (x.y.z)')}
        </>
      )}
    </div>
  );
}

const SLIDERS = [
  { label: 'Hue shift', min: -180, max: 180, step: 1, get: (t: SkinFamilyDef['transform']) => t.hueShift ?? 0, set: (v: number) => ({ hueShift: v || undefined }) },
  { label: 'Saturation ×', min: 0, max: 2, step: 0.05, get: (t: SkinFamilyDef['transform']) => t.saturation ?? 1, set: (v: number) => ({ saturation: v === 1 ? undefined : v }) },
  { label: 'Lightness offset', min: -1, max: 1, step: 0.02, get: (t: SkinFamilyDef['transform']) => t.lightness?.offset ?? 0, set: (v: number, t: SkinFamilyDef['transform']) => ({ lightness: { offset: v, scale: t.lightness?.scale ?? 1 } }) },
  { label: 'Lightness scale', min: 0, max: 2, step: 0.02, get: (t: SkinFamilyDef['transform']) => t.lightness?.scale ?? 1, set: (v: number, t: SkinFamilyDef['transform']) => ({ lightness: { offset: t.lightness?.offset ?? 0, scale: v } }) },
  { label: 'Tint amount', min: 0, max: 1, step: 0.02, get: (t: SkinFamilyDef['transform']) => t.tint?.amount ?? 0, set: (v: number, t: SkinFamilyDef['transform']) => ({ tint: v ? { color: t.tint?.color ?? '#FFFFFF', amount: v } : undefined }) },
];

/** One family across all 50 species: transform sliders, live sprite grid, per-species overrides. */
function FamilyEditor({ family, focus, onFocus, onChange }: { family: SkinFamilyDef; focus: string; onFocus: (id: string) => void; onChange: (p: Record<string, unknown>) => void }) {
  const t = family.transform;
  const skins = useMemo(() => {
    const species = CATALOG.map((s) => content.get(s.id)).filter((s) => s?.kind === 'species');
    return expandFamily(family, species as never, builtinModels());
  }, [family]);
  const setTransform = (patch: Partial<SkinFamilyDef['transform']>) => onChange({ transform: { ...t, ...patch } });
  const focused = skins.find((s) => s.speciesId === focus);
  const override = (family.overrides ?? {})[focus];
  const setOverride = (key: PaletteKey, color: string) =>
    onChange({ overrides: { ...family.overrides, [focus]: { ...override, palette: { ...override?.palette, [key]: color.toUpperCase() } } } });
  const clearOverride = () => {
    const rest = { ...family.overrides };
    delete rest[focus];
    onChange({ overrides: Object.keys(rest).length ? rest : undefined });
  };
  return (
    <div className={styles.block}>
      <h3 className={styles.sub}>Family transform</h3>
      {SLIDERS.map((s) => (
        <label key={s.label} className={styles.field}>
          {s.label} <span className={styles.small}>{s.get(t)}</span>
          <input type="range" min={s.min} max={s.max} step={s.step} value={s.get(t)} onChange={(e) => setTransform(s.set(Number(e.target.value), t))} />
        </label>
      ))}
      <label className={styles.field}>
        Tint color
        <input type="color" value={(t.tint?.color ?? '#FFFFFF').toLowerCase()} onChange={(e) => setTransform({ tint: { color: e.target.value.toUpperCase(), amount: t.tint?.amount ?? 0.3 } })} />
      </label>
      <div className={styles.row}>
        {[0, 1, 2, 3].map((r) => (
          <label key={r} className={styles.field}>
            Tier {r} price
            <input className={styles.input} type="number" value={family.priceByTierRank[r]} onChange={(e) => onChange({ priceByTierRank: family.priceByTierRank.map((p, i) => (i === r ? Number(e.target.value) : p)) })} />
          </label>
        ))}
      </div>
      <h3 className={styles.sub}>All species</h3>
      <ul className={styles.grid}>
        {skins.map((s) => (
          <li key={s.id}>
            <button type="button" className={s.speciesId === focus ? styles.cellOn : styles.cell} onClick={() => onFocus(s.speciesId)} title={s.name.en}>
              <VoxelSprite modelId={getSpecies(s.speciesId).modelId} colors={s.palette} size={44} />
              {family.overrides?.[s.speciesId] && <span className={styles.dot} />}
            </button>
          </li>
        ))}
      </ul>
      {focused && (
        <div className={styles.block}>
          <h3 className={styles.sub}>Override: {getSpecies(focus).name}</h3>
          {Object.entries({ ...builtinModels()[`species/${getSpecies(focus).modelId}`]!.palette, ...focused.palette }).map(([key, color]) => (
            <label key={key} className={styles.swatch}>
              <input type="color" value={(color as string).toLowerCase()} onChange={(e) => setOverride(key as PaletteKey, e.target.value)} /> {key}
            </label>
          ))}
          {override && <button type="button" className={styles.button} onClick={clearOverride}>Remove override</button>}
        </div>
      )}
    </div>
  );
}

/** The preview island for an item: a sample terrain with the item shown near the camp. */
function previewModel(def: ContentDef | undefined, o: { seed: number; themeId: string; tile: { x: number; z: number }; rotation: Rotation }): IslandModel {
  const free = [...getOccupancy({ seed: o.seed, islandLevel: LEVEL, animals: [], buildings: [] }).values()]
    .filter(isFreeForAnimal)
    .sort((a, b) => Math.hypot(a.x - 1, a.z - 1) - Math.hypot(b.x - 1, b.z - 1) || a.x - b.x || a.z - b.z);
  const animal = (speciesId: string, skinId: string, i: number): IslandAnimal => {
    const s = getSpecies(speciesId);
    return { id: `studio-${i}`, speciesId, tierRank: s.tierRank, tile: { x: free[i]!.x, z: free[i]!.z }, skinId };
  };
  const model: IslandModel = { ownerId: 'studio', seed: o.seed, islandLevel: LEVEL, blockThemeId: o.themeId, animals: [], buildings: [], goldPileLevel: 3 };
  const sample = ['rabbit', 'cat', 'fox', 'panda', 'unicorn', 'tiger', 'duck', 'owl'];
  switch (def?.kind) {
    case 'species': {
      const skins = content.all('animalSkin').filter((s) => s.speciesId === def.id).slice(0, 7);
      model.animals = [animal(def.id, 'default', 0), ...skins.map((s, i) => animal(def.id, s.id, i + 1))];
      break;
    }
    case 'animalSkin':
      model.animals = [animal(def.speciesId, def.id, 0), animal(def.speciesId, 'default', 1)];
      break;
    case 'skinFamily':
      model.animals = sample.map((id, i) => animal(id, `${def.id}:${id}`, i));
      break;
    case 'blockTheme':
      model.blockThemeId = def.id;
      model.animals = sample.slice(0, 5).map((id, i) => animal(id, 'default', i));
      break;
    case 'building': {
      model.buildings = [{ id: 'studio-b', defId: def.id, tile: o.tile, rotation: o.rotation }];
      const covered = new Set(footprintTiles(o.tile, def.footprint, o.rotation).map((t) => `${t.x},${t.z}`));
      model.animals = sample.slice(0, 6).map((id, i) => animal(id, 'default', i)).filter((a) => !covered.has(`${a.tile.x},${a.tile.z}`));
      break;
    }
    case 'release': {
      const featured = def.featured.map((id) => content.get(id));
      model.buildings = featured.flatMap((f, i) => (f?.kind === 'building' ? [{ id: `studio-f${i}`, defId: f.id, tile: { x: free[10 + i * 3]!.x, z: free[10 + i * 3]!.z }, rotation: 0 as const }] : []));
      model.animals = featured.flatMap((f, i) => (f?.kind === 'animalSkin' ? [animal(f.speciesId, f.id, i)] : []));
      const theme = featured.find((f) => f?.kind === 'blockTheme');
      if (theme) model.blockThemeId = theme.id;
      break;
    }
    default:
      model.animals = sample.slice(0, 4).map((id, i) => animal(id, 'default', i));
  }
  return model;
}

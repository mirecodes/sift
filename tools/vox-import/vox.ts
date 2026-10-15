/**
 * Minimal MagicaVoxel `.vox` reader and writer (format 150/200): models (SIZE/XYZI), the scene graph
 * (nTRN/nGRP/nSHP) with object names and translations, layers (LAYR) and the palette (RGBA).
 * MagicaVoxel is z-up; conversion to Sift's y-up happens in `import.ts`.
 */

export type Vec3 = [number, number, number];

export interface VoxModelData {
  size: Vec3;
  /** [x, y, z, colorIndex 1–255] in MagicaVoxel coordinates. */
  voxels: [number, number, number, number][];
}

/** A placed model with the name of its object (or layer) and its translation. */
export interface VoxObject {
  name?: string;
  layer?: string;
  t: Vec3;
  model: VoxModelData;
}

export interface VoxScene {
  objects: VoxObject[];
  /** `palette[i]` is the `#RRGGBB` color of color index i (1–255); index 0 is unused. */
  palette: string[];
}

type Dict = Record<string, string>;
type SceneNode =
  | { type: 'trn'; attrs: Dict; child: number; layer: number; t: Vec3 }
  | { type: 'grp'; children: number[] }
  | { type: 'shp'; models: number[] };

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

export function readVox(bytes: Uint8Array): VoxScene {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 0;
  const id = () => String.fromCharCode(bytes[p]!, bytes[p + 1]!, bytes[p + 2]!, bytes[p + 3]!);
  const int = () => {
    const v = view.getInt32(p, true);
    p += 4;
    return v;
  };
  const str = () => {
    const n = int();
    const s = new TextDecoder().decode(bytes.subarray(p, p + n));
    p += n;
    return s;
  };
  const dict = (): Dict => {
    const out: Dict = {};
    for (let n = int(); n > 0; n--) out[str()] = str();
    return out;
  };

  if (id() !== 'VOX ') throw new Error('Not a MagicaVoxel file (missing "VOX " header)');
  p += 8;
  if (id() !== 'MAIN') throw new Error('Not a MagicaVoxel file (missing MAIN chunk)');
  p += 4;
  const mainContent = int();
  const mainChildren = int();
  p += mainContent;
  const end = p + mainChildren;

  const models: VoxModelData[] = [];
  const nodes = new Map<number, SceneNode>();
  const layers = new Map<number, string | undefined>();
  let palette: string[] | undefined;
  let size: Vec3 | undefined;

  while (p < end) {
    const chunk = id();
    p += 4;
    const content = int();
    const children = int();
    const next = p + content + children;
    switch (chunk) {
      case 'SIZE':
        size = [int(), int(), int()];
        break;
      case 'XYZI': {
        const voxels: VoxModelData['voxels'] = [];
        for (let n = int(); n > 0; n--) {
          voxels.push([bytes[p]!, bytes[p + 1]!, bytes[p + 2]!, bytes[p + 3]!]);
          p += 4;
        }
        if (!size) throw new Error('XYZI chunk without SIZE');
        models.push({ size, voxels });
        break;
      }
      case 'RGBA':
        palette = ['#000000'];
        for (let i = 0; i < 255; i++) palette.push(hex(bytes[p + i * 4]!, bytes[p + i * 4 + 1]!, bytes[p + i * 4 + 2]!));
        break;
      case 'nTRN': {
        const nodeId = int();
        const attrs = dict();
        const child = int();
        int(); // reserved
        const layer = int();
        const frames = int();
        let t: Vec3 = [0, 0, 0];
        for (let f = 0; f < frames; f++) {
          const frame = dict();
          if (f === 0 && frame._t) t = frame._t.split(' ').map(Number) as Vec3;
        }
        nodes.set(nodeId, { type: 'trn', attrs, child, layer, t });
        break;
      }
      case 'nGRP': {
        const nodeId = int();
        dict();
        const list: number[] = [];
        for (let n = int(); n > 0; n--) list.push(int());
        nodes.set(nodeId, { type: 'grp', children: list });
        break;
      }
      case 'nSHP': {
        const nodeId = int();
        dict();
        const list: number[] = [];
        for (let n = int(); n > 0; n--) {
          list.push(int());
          dict();
        }
        nodes.set(nodeId, { type: 'shp', models: list });
        break;
      }
      case 'LAYR': {
        const layerId = int();
        layers.set(layerId, dict()._name);
        break;
      }
    }
    p = next;
  }
  if (!palette) throw new Error('The file has no palette (RGBA chunk). Start from content/models/palette-template.vox.');

  const objects: VoxObject[] = [];
  if (!nodes.size) {
    for (const model of models) objects.push({ t: [0, 0, 0], model });
  } else {
    const walk = (nodeId: number, t: Vec3, name: string | undefined, layer: string | undefined) => {
      const node = nodes.get(nodeId);
      if (!node) return;
      if (node.type === 'trn') {
        const nt: Vec3 = [t[0] + node.t[0], t[1] + node.t[1], t[2] + node.t[2]];
        walk(node.child, nt, node.attrs._name ?? name, layers.get(node.layer) ?? layer);
      } else if (node.type === 'grp') {
        for (const c of node.children) walk(c, t, name, layer);
      } else {
        for (const m of node.models) {
          const model = models[m];
          if (model) objects.push({ ...(name ? { name } : {}), ...(layer ? { layer } : {}), t, model });
        }
      }
    };
    walk(0, [0, 0, 0], undefined, undefined);
  }
  return { objects, palette };
}

/** Writes a scene as `.vox` (used for the palette template and tests). */
export function writeVox(scene: VoxScene): Uint8Array {
  const out: number[] = [];
  const int = (v: number, to = out) => {
    to.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255);
  };
  const str = (s: string, to: number[]) => {
    const b = new TextEncoder().encode(s);
    int(b.length, to);
    to.push(...b);
  };
  const dict = (d: Dict, to: number[]) => {
    const entries = Object.entries(d);
    int(entries.length, to);
    for (const [k, v] of entries) {
      str(k, to);
      str(v, to);
    }
  };
  const chunk = (name: string, content: number[]) => {
    const c: number[] = [...new TextEncoder().encode(name)];
    int(content.length, c);
    int(0, c);
    return c.concat(content);
  };

  const children: number[] = [];
  scene.objects.forEach((o) => {
    const s: number[] = [];
    o.model.size.forEach((v) => int(v, s));
    children.push(...chunk('SIZE', s));
    const x: number[] = [];
    int(o.model.voxels.length, x);
    for (const v of o.model.voxels) x.push(...v);
    children.push(...chunk('XYZI', x));
  });
  const layerNames = [...new Set(scene.objects.map((o) => o.layer ?? ''))];
  // Scene graph: root transform 0 → group 1 → (transform 2k+2 → shape 2k+3) per object.
  const root: number[] = [];
  int(0, root);
  dict({}, root);
  int(1, root);
  int(-1, root);
  int(-1, root);
  int(1, root);
  dict({}, root);
  children.push(...chunk('nTRN', root));
  const grp: number[] = [];
  int(1, grp);
  dict({}, grp);
  int(scene.objects.length, grp);
  scene.objects.forEach((_, k) => int(2 * k + 2, grp));
  children.push(...chunk('nGRP', grp));
  scene.objects.forEach((o, k) => {
    const trn: number[] = [];
    int(2 * k + 2, trn);
    dict(o.name ? { _name: o.name } : {}, trn);
    int(2 * k + 3, trn);
    int(-1, trn);
    int(layerNames.indexOf(o.layer ?? ''), trn);
    int(1, trn);
    dict({ _t: o.t.join(' ') }, trn);
    children.push(...chunk('nTRN', trn));
    const shp: number[] = [];
    int(2 * k + 3, shp);
    dict({}, shp);
    int(1, shp);
    int(k, shp);
    dict({}, shp);
    children.push(...chunk('nSHP', shp));
  });
  layerNames.forEach((name, i) => {
    const l: number[] = [];
    int(i, l);
    dict(name ? { _name: name } : {}, l);
    int(-1, l);
    children.push(...chunk('LAYR', l));
  });
  const rgba: number[] = [];
  for (let i = 1; i <= 256; i++) {
    const c = scene.palette[i] ?? '#000000';
    const n = parseInt(c.slice(1), 16);
    rgba.push((n >> 16) & 255, (n >> 8) & 255, n & 255, 255);
  }
  children.push(...chunk('RGBA', rgba));

  const file: number[] = [...new TextEncoder().encode('VOX ')];
  int(200, file);
  file.push(...new TextEncoder().encode('MAIN'));
  int(0, file);
  int(children.length, file);
  return new Uint8Array(file.concat(children));
}

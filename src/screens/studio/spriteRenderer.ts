import {
  AmbientLight,
  Box3,
  BoxGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshLambertMaterial,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import type { PackItem } from '../../../shared/content/pack';
import { hasSprite, SPRITE_SIZE, spriteInputHash, type AtlasIndex } from '../../../shared/content/sprites';
import { getSpecies } from '../../domain/animals/catalog';
import { baselinePack } from '../../domain/content/baseline';
import { ELEVATION } from '../../world/camera/CameraRig';
import { lighting } from '../../world/palette';
import { animalGeometry, blockGeometries, buildingMeshes } from '../../world/voxel/geometry';

/**
 * Sprite generator (guidance_v2 Step 3.5), run in a browser by `npm run content:sprites`: every species,
 * skin, building and block-theme swatch rendered with the island's isometric orthographic camera and
 * lighting, no antialiasing, at `SPRITE_SIZE` px, alpha cut to on/off, into one atlas. Flat shading
 * gives each voxel face one color, so sprites use only the model palette in three shades.
 */

const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
const AZIMUTH = Math.PI / 4;
const MARGIN = 1.08;

function subject(item: PackItem): Object3D | null {
  const g = new Group();
  switch (item.kind) {
    case 'species':
      g.add(new Mesh(animalGeometry(getSpecies(item.id).modelId), material));
      return g;
    case 'animalSkin':
      g.add(new Mesh(animalGeometry(getSpecies(item.speciesId).modelId, item.id), material));
      return g;
    case 'building': {
      const m = buildingMeshes(item.id);
      if (!m) return null;
      g.add(new Mesh(m.main, material));
      if (m.glow) g.add(new Mesh(m.glow, material));
      for (const p of m.parts) {
        const part = new Mesh(p.geometry, material);
        part.position.set(...p.pivot);
        g.add(part);
      }
      return g;
    }
    case 'blockTheme': {
      // A 3×3 patch of grass blocks with water in the middle.
      const blocks = blockGeometries(item.palette);
      const water = new Mesh(new BoxGeometry(1, 0.7, 1), new MeshLambertMaterial({ color: item.palette.water, flatShading: true }));
      for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
        const mesh = x === 0 && z === 0 ? water : new Mesh(blocks.grass, material);
        mesh.position.set(x, x === 0 && z === 0 ? -0.15 : 0, z);
        g.add(mesh);
      }
      return g;
    }
    default:
      return null;
  }
}

/** Fits an orthographic camera tightly around the object, seen from the isometric angle. */
function frame(camera: OrthographicCamera, object: Object3D) {
  const box = new Box3().setFromObject(object);
  const center = box.getCenter(new Vector3());
  const dir = new Vector3(Math.sin(AZIMUTH) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(AZIMUTH) * Math.cos(ELEVATION));
  camera.position.copy(center).addScaledVector(dir, 50);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const view = camera.matrixWorldInverse;
  let half = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new Vector3(x, y, z).applyMatrix4(view);
    half = Math.max(half, Math.abs(p.x), Math.abs(p.y));
  }
  half *= MARGIN;
  Object.assign(camera, { left: -half, right: half, top: half, bottom: -half, near: 0.1, far: 200 });
  camera.updateProjectionMatrix();
}

export function renderAtlas(): { png: string; index: AtlasIndex } {
  const items = baselinePack.items.filter(hasSprite);
  const S = SPRITE_SIZE;
  const columns = Math.ceil(Math.sqrt(items.length));
  const renderer = new WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(S, S);
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const k = lighting.intensityScale;
  const [dx, dy, dz] = lighting.direction;
  scene.add(new AmbientLight('#FFFFFF', lighting.ambient * k));
  const sun = new DirectionalLight('#FFFFFF', lighting.directional * k);
  sun.position.set(dx * 50, dy * 50, dz * 50);
  scene.add(sun);
  const camera = new OrthographicCamera();

  const atlas = document.createElement('canvas');
  atlas.width = columns * S;
  atlas.height = Math.ceil(items.length / columns) * S;
  const ctx = atlas.getContext('2d')!;
  const frames: Record<string, readonly [number, number, string]> = {};
  items.forEach((item, i) => {
    const object = subject(item);
    if (!object) return;
    scene.add(object);
    frame(camera, object);
    renderer.render(scene, camera);
    scene.remove(object);
    const [x, y] = [(i % columns) * S, Math.floor(i / columns) * S];
    ctx.drawImage(renderer.domElement, x, y);
    frames[item.id] = [x, y, spriteInputHash(item, baselinePack)];
  });
  // Pixel art: every pixel is fully opaque or fully transparent.
  const pixels = ctx.getImageData(0, 0, atlas.width, atlas.height);
  for (let p = 3; p < pixels.data.length; p += 4) pixels.data[p] = (pixels.data[p] as number) < 128 ? 0 : 255;
  ctx.putImageData(pixels, 0, 0);
  renderer.dispose();
  return { png: atlas.toDataURL('image/png'), index: { size: S, width: atlas.width, height: atlas.height, frames } };
}

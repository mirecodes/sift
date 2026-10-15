import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { Box3, MeshBasicMaterial, MeshLambertMaterial, Sphere, Vector3, type Group } from 'three';
import { getSpecies } from '../../domain/animals/catalog';
import { content } from '../../domain/content';
import { generateIsland } from '../../domain/island/island';
import { ELEVATION } from '../camera/CameraRig';
import { Island } from '../island/Island';
import { lighting } from '../palette';
import { Camp } from '../props/Camp';
import { Stream } from '../stream/Stream';
import { buildingMeshes, themePalette } from '../voxel/geometry';
import { RewardModel } from './RewardModel';

const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
const unlit = new MeshBasicMaterial({ vertexColors: true });
const AZIMUTH = Math.PI / 4;
const PREVIEW_SEED = 5;

/** Turns its content slowly and fits the camera to its bounding sphere (so nothing clips while it turns). */
function Turntable({ children, reducedMotion }: { children: ReactNode; reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const g = group.current;
    if (!g) return;
    const sphere = new Box3().setFromObject(g).getBoundingSphere(new Sphere());
    const dir = new Vector3(Math.sin(AZIMUTH) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(AZIMUTH) * Math.cos(ELEVATION));
    camera.position.copy(sphere.center).addScaledVector(dir, 50);
    camera.lookAt(sphere.center);
    camera.zoom = (Math.min(size.width, size.height) / (2 * sphere.radius)) * 0.98;
    camera.updateProjectionMatrix();
  }, [camera, size]);
  useFrame((_, delta) => {
    if (group.current && !reducedMotion) group.current.rotation.y += (Math.PI * 2 * Math.min(delta, 0.1)) / 10;
  });
  return (
    <group ref={group} rotation={[0, reducedMotion ? Math.PI / 4 : 0, 0]}>
      {children}
    </group>
  );
}

function BuildingModel({ id }: { id: string }) {
  const m = buildingMeshes(id);
  if (!m) return null;
  return (
    <>
      <mesh geometry={m.main} material={material} />
      {m.glow && <mesh geometry={m.glow} material={unlit} />}
      {m.parts.map((p) => (
        <group key={p.name} position={p.pivot}>
          <mesh geometry={p.geometry} material={material} />
        </group>
      ))}
    </>
  );
}

/** A small island in a block theme's colors. */
function ThemeIsland({ id, reducedMotion }: { id: string; reducedMotion: boolean }) {
  const blocks = themePalette(id);
  const { tiles, streams } = useMemo(() => generateIsland(PREVIEW_SEED, 2), []);
  const night = useRef(0);
  return (
    <group>
      <Island seed={PREVIEW_SEED} level={2} animate={false} blocks={blocks} />
      <Stream streams={streams} tiles={tiles} timeScale={1} reducedMotion={reducedMotion} blocks={blocks} />
      <Camp night={night} reducedMotion={reducedMotion} blocks={blocks} />
    </group>
  );
}

/**
 * A slowly turning preview of a shop item (DESIGN.md 7.7): the skinned animal, the building, or a
 * small island in the theme. One small canvas, only while the confirm sheet is open.
 */
export function ItemPreview({ id, height = 180, reducedMotion }: { id: string; height?: number; reducedMotion: boolean }) {
  const item = content.get(id);
  if (item?.kind === 'animalSkin') return <RewardModel modelId={getSpecies(item.speciesId).modelId} skinId={id} height={height} reducedMotion={reducedMotion} />;
  if (item?.kind !== 'building' && item?.kind !== 'blockTheme') return null;
  const k = lighting.intensityScale;
  const [dx, dy, dz] = lighting.direction;
  return (
    <div style={{ height, width: '100%' }} aria-hidden="true">
      <Canvas orthographic flat dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ near: 0.1, far: 200, zoom: 40 }}>
        <ambientLight intensity={lighting.ambient * k} />
        <directionalLight position={[dx * 10, dy * 10, dz * 10]} intensity={lighting.directional * k} />
        <Turntable reducedMotion={reducedMotion}>{item.kind === 'building' ? <BuildingModel id={id} /> : <ThemeIsland id={id} reducedMotion={reducedMotion} />}</Turntable>
      </Canvas>
    </div>
  );
}

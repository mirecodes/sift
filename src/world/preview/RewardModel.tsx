import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { MeshLambertMaterial, type Group } from 'three';
import { animalGeometry, skinnedModel, VOXEL_SIZE } from '../voxel/geometry';
import { ELEVATION } from '../camera/CameraRig';
import { lighting } from '../palette';

const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

function Spinner({ modelId, skinId, reducedMotion }: { modelId: string; skinId?: string; reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  const geometry = useMemo(() => animalGeometry(modelId, skinId), [modelId, skinId]);
  useFrame((_, delta) => {
    if (group.current && !reducedMotion) group.current.rotation.y += (Math.PI * 2 * Math.min(delta, 0.1)) / 8; // one turn per 8s
  });
  return (
    <group ref={group} rotation={[0, reducedMotion ? Math.PI / 4 : 0, 0]}>
      <mesh geometry={geometry} material={material} />
    </group>
  );
}

/** Small transparent canvas that shows one animal rotating slowly (Break reward card, shop previews). */
export function RewardModel({ modelId, skinId, height = 160, reducedMotion }: { modelId: string; skinId?: string; height?: number; reducedMotion: boolean }) {
  const model = skinnedModel(modelId, skinId);
  const worldHeight = model.size[1] * VOXEL_SIZE;
  // Worst case over the rotation: height plus the footprint diagonal seen at the camera elevation.
  const diagonal = Math.hypot(model.size[0], model.size[2]) * VOXEL_SIZE;
  const zoom = (height * 0.92) / (worldHeight * Math.cos(ELEVATION) + diagonal * Math.sin(ELEVATION));
  const k = lighting.intensityScale;
  const [dx, dy, dz] = lighting.direction;
  const lookY = worldHeight / 2;

  return (
    <div style={{ height, width: '100%' }} aria-hidden="true">
      <Canvas
        orthographic
        flat
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [6, lookY + 6 * Math.tan(ELEVATION) * Math.SQRT2, 6], zoom, near: 0.1, far: 100 }}
        onCreated={({ camera }) => camera.lookAt(0, lookY, 0)}
      >
        <ambientLight intensity={lighting.ambient * k} />
        <directionalLight position={[dx * 10, dy * 10, dz * 10]} intensity={lighting.directional * k} />
        <Spinner modelId={modelId} skinId={skinId} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}

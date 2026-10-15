import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { BoxGeometry, Color, Group, InstancedMesh, MeshBasicMaterial, MeshLambertMaterial, Object3D } from 'three';
import { CAMP_LEVEL, COIN_PILE_TILE, levelTop } from '../../domain/island/island';
import { palette } from '../palette';
import { PILE_VOXEL, pileVoxels } from './pileVoxels';

const SURFACE_Y = levelTop(CAMP_LEVEL) + 0.5;
const box = new BoxGeometry(1, 1, 1);
const material = new MeshLambertMaterial({ flatShading: true });
const sparkMaterial = new MeshBasicMaterial({ color: '#FFFFFF' });
const SPARKS = 3;
/** Share of the coin color the pile gives off at night: it catches the firelight. */
const NIGHT_GLOW = 0.3;
const colors = [new Color(palette.coin), new Color(palette.coinDark)];

interface Props {
  /** 0..6 from `goldPileLevel`; 0 draws nothing. */
  level: number;
  night: MutableRefObject<number>;
  /** Sparkles twinkle only at night, never on Focus or with reduced motion. */
  sparkle: boolean;
}

/** Gold voxel heap on the reserved camp tile next to the cabin (DESIGN.md 15.6). One instanced mesh. */
export function CoinPile({ level, night, sparkle }: Props) {
  const voxels = useMemo(() => pileVoxels(level), [level]);
  const mesh = useRef<InstancedMesh>(null);
  const sparks = useRef<Group>(null);
  // Sparkles sit on the highest voxels.
  const tops = useMemo(() => [...voxels].sort((a, b) => b[1] - a[1] || a[0] - b[0] || a[2] - b[2]).filter((_, i) => i % 3 === 0).slice(0, SPARKS), [voxels]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new Object3D();
    voxels.forEach(([x, y, z], i) => {
      o.position.set(x * PILE_VOXEL, (y + 0.5) * PILE_VOXEL, z * PILE_VOXEL);
      o.scale.setScalar(PILE_VOXEL);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, colors[(x + y + z + 99) % 2]!);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [voxels]);

  useFrame(({ clock }) => {
    const n = night.current;
    material.emissive.copy(colors[0]!).multiplyScalar(NIGHT_GLOW * n);
    const g = sparks.current;
    if (!g) return;
    g.visible = sparkle && n > 0.05;
    if (!g.visible) return;
    g.children.forEach((child, i) => {
      const pulse = Math.max(0, Math.sin(clock.elapsedTime * 1.7 + i * 2.1)) ** 6;
      child.scale.setScalar(0.05 * pulse * n);
    });
  });

  if (!voxels.length) return null;
  return (
    <group position={[COIN_PILE_TILE.x, SURFACE_Y, COIN_PILE_TILE.z]}>
      <instancedMesh key={voxels.length} ref={mesh} args={[box, material, voxels.length]} />
      <group ref={sparks} visible={false}>
        {tops.map(([x, y, z], i) => (
          <mesh key={i} geometry={box} material={sparkMaterial} position={[x * PILE_VOXEL, (y + 1.1) * PILE_VOXEL, z * PILE_VOXEL]} rotation={[0, Math.PI / 4, Math.PI / 4]} />
        ))}
      </group>
    </group>
  );
}

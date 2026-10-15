import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import { BoxGeometry, Color, Group, MeshBasicMaterial } from 'three';
import { hash01 } from '../domain/random';
import { night as nightPalette, palette } from './palette';

const geometry = new BoxGeometry(1, 1, 1);
const material = new MeshBasicMaterial({ color: palette.cloud, transparent: true, opacity: palette.cloudOpacity });

const dayCloud = new Color(palette.cloud);
const nightCloud = new Color(nightPalette.cloud);
const COUNT = 5;
// Screen-right and away-from-camera directions at the default 45° azimuth.
const RIGHT = [Math.SQRT1_2, -Math.SQRT1_2] as const;
const BACK = [-Math.SQRT1_2, -Math.SQRT1_2] as const;

interface Puff {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

/** 3–6 low-poly voxel clouds drifting slowly behind the island (Home and Break only). */
export function Clouds({ seed, side, depth, visible, reducedMotion, night, tint }: {
  night: MutableRefObject<number>;
  seed: number;
  side: number;
  depth: number;
  visible: boolean;
  reducedMotion: boolean;
  /** Day color from the block theme (`cloudTint`, Step 3.8). */
  tint?: string;
}) {
  const groups = useRef<Group[]>([]);
  const day = useMemo(() => (tint ? new Color(tint) : dayCloud), [tint]);
  const span = side * 1.1 + 8;

  const clouds = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const puffs: Puff[] = [];
        const n = 3 + Math.floor(hash01(seed, i, 1) * 3);
        for (let p = 0; p < n; p++) {
          puffs.push({
            x: p * 1.4 - n * 0.7,
            y: hash01(seed, i, 10 + p) * 0.6,
            z: (hash01(seed, i, 20 + p) - 0.5) * 1.2,
            w: 1.8 + hash01(seed, i, 30 + p) * 1.2,
            h: 0.8 + hash01(seed, i, 40 + p) * 0.4,
            d: 1.4 + hash01(seed, i, 50 + p) * 0.8,
          });
        }
        return {
          u0: (i / COUNT) * span * 2 - span,
          v: side * 0.7 + 3 + hash01(seed, i, 2) * 5,
          y: -depth * 0.6 + hash01(seed, i, 3) * (depth * 0.6 + 2),
          speed: 0.12 + hash01(seed, i, 4) * 0.1,
          puffs,
        };
      }),
    [seed, side, depth, span],
  );

  useFrame(({ clock }) => {
    if (!visible) return;
    material.color.copy(day).lerp(nightCloud, night.current);
    material.opacity = palette.cloudOpacity + (nightPalette.cloudOpacity - palette.cloudOpacity) * night.current;
    const t = reducedMotion ? 0 : clock.elapsedTime;
    clouds.forEach((c, i) => {
      const g = groups.current[i];
      if (!g) return;
      const u = ((((c.u0 + t * c.speed + span) % (span * 2)) + span * 2) % (span * 2)) - span;
      g.position.set(RIGHT[0] * u + BACK[0] * c.v, c.y, RIGHT[1] * u + BACK[1] * c.v);
    });
  });

  return (
    <group visible={visible}>
      {clouds.map((c, i) => (
        <group
          key={i}
          ref={(g) => {
            if (g) groups.current[i] = g;
          }}
          rotation={[0, Math.PI / 4, 0]}
          scale={0.55}
        >
          {c.puffs.map((p, j) => (
            <mesh key={j} geometry={geometry} material={material} position={[p.x, p.y, p.z]} scale={[p.w, p.h, p.d]} />
          ))}
        </group>
      ))}
    </group>
  );
}

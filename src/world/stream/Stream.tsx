import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, InstancedMesh, MeshBasicMaterial, MeshLambertMaterial, NearestFilter, Object3D, RepeatWrapping, SRGBColorSpace } from 'three';
import { config } from '../../domain/config';
import { hash01 } from '../../domain/random';
import type { Cell, StreamTile } from '../../domain/island/island';
import type { BlockPalette } from '../../../shared/content/palette';
import { defaultBlocks, palette } from '../palette';
import { toGeometry } from '../voxel/geometry';
import { bankMesh, buildStreamMesh } from './streamMesh';

/** Same look as the island's terrain blocks, so the bank blends into the surrounding grass. */
const bankMaterial = new MeshLambertMaterial({ vertexColors: true, flatShading: true, side: DoubleSide });

const GRAVITY = 5;
/** Streak pattern repeats every this many blocks along the stream. */
const PATTERN_BLOCKS = 2;
const dummy = new Object3D();
const cube = new BoxGeometry(1, 1, 1);
const splashMaterial = new MeshBasicMaterial({ color: palette.splash });

/** Small pixel-art texture: water with a few lighter streaks. */
function streakTexture(blocks: BlockPalette): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = blocks.water;
  ctx.fillRect(0, 0, 8, 16);
  ctx.fillStyle = blocks.waterStreak;
  for (let i = 0; i < 6; i++) ctx.fillRect(Math.floor(hash01(3, i, 1) * 7), Math.floor(hash01(3, i, 2) * 14), 1, 2 + (i % 3));
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.magFilter = t.minFilter = NearestFilter;
  t.colorSpace = SRGBColorSpace;
  // The v coordinate is in blocks; one pattern tile covers PATTERN_BLOCKS.
  t.repeat.set(1, 1 / PATTERN_BLOCKS);
  return t;
}

interface Props {
  streams: readonly (readonly StreamTile[])[];
  /** Island surface tiles, to close the bank where the island side is exposed. */
  tiles: readonly Cell[];
  /** 1 on Home and Break, slowed on Focus. */
  timeScale: number;
  reducedMotion: boolean;
  /** Block theme colors for water and banks (Step 3.8). */
  blocks?: BlockPalette;
}

/** The stream: a smoothed water ribbon with curved falls, scrolling streaks and white splash at every landing. */
export function Stream({ streams, tiles, timeScale, reducedMotion, blocks = defaultBlocks }: Props) {
  const meshes = useMemo(() => streams.map((run) => buildStreamMesh(run)), [streams]);
  const geometries = useMemo(
    () =>
      meshes.map((m) => {
        const g = new BufferGeometry();
        g.setAttribute('position', new BufferAttribute(m.positions, 3));
        g.setAttribute('uv', new BufferAttribute(m.uvs, 2));
        g.setIndex(new BufferAttribute(m.indices, 1));
        g.computeVertexNormals();
        return g;
      }),
    [meshes],
  );
  const texture = useMemo(() => streakTexture(blocks), [blocks]);
  const material = useMemo(
    () => new MeshLambertMaterial({ map: texture, side: DoubleSide }),
    [texture],
  );
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  useEffect(
    () => () => {
      texture.dispose();
      material.dispose();
    },
    [texture, material],
  );

  // The bank: grass around the channel, following the ribbon edge.
  const banks = useMemo(() => {
    const top = new Map(tiles.map((t) => [`${t.x},${t.z}`, t.top + 0.5]));
    return streams.map((run, i) => toGeometry(bankMesh(run, meshes[i]!, (x, z) => top.get(`${x},${z}`), blocks)));
  }, [streams, meshes, tiles, blocks]);
  useEffect(() => () => banks.forEach((g) => g.dispose()), [banks]);

  const splashes = useMemo(() => meshes.flatMap((m) => m.splashes), [meshes]);
  const particles = useMemo(
    () =>
      splashes.flatMap((s, e) => {
        const spring = s.kind === 'spring';
        const per = spring ? config.stream.springCount : config.stream.splashCount;
        return Array.from({ length: per }, (_, k) => {
          const r = (n: number) => hash01(11, e, k, n);
          // Spring water bursts up from the pool in all directions; splashes go up and downstream.
          const angle = r(7) * Math.PI * 2;
          const speed = 0.15 + r(3) * 0.3;
          return {
            s,
            life: spring ? config.stream.springLifeS : config.stream.splashLifeS,
            phase: (k + r(1) * 0.6) / per,
            up: spring ? 2 + r(2) * 1.4 : 0.9 + r(2) * 0.9,
            forward: spring ? Math.cos(angle) * speed : 0.1 + r(3) * 0.45,
            side: spring ? Math.sin(angle) * speed : (r(4) - 0.5) * 0.9,
            size: (spring ? 0.06 : 0.05) + r(5) * 0.04,
            ahead: spring ? (r(8) - 0.5) * 0.16 : 0,
            spread: spring ? (r(6) - 0.5) * 0.16 : (r(6) - 0.5) * config.stream.width,
          };
        });
      }),
    [splashes],
  );
  const spray = useRef<InstancedMesh>(null);
  const time = useRef(0);

  const place = (t: number) => {
    const mesh = spray.current;
    if (!mesh) return;
    particles.forEach((p, i) => {
      const age = (((t / p.life + p.phase) % 1) + 1) % 1 * p.life;
      const { s } = p;
      // Local frame: `forward` follows the flow, `side` is across the stream.
      const f = p.ahead + p.forward * age;
      const w = p.spread + p.side * age;
      const y = p.up * age - 0.5 * GRAVITY * age * age;
      const hidden = s.kind !== 'rim' && y < 0;
      const shrink = hidden ? 0 : p.size * Math.sqrt(1 - age / p.life);
      dummy.position.set(s.x + s.dx * f - s.dz * w, s.y + y, s.z + s.dz * f + s.dx * w);
      dummy.scale.setScalar(shrink);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => place(time.current), [particles]);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    time.current += Math.min(delta, 0.1) * timeScale;
    texture.offset.y = -(time.current * config.stream.flowSpeed) / PATTERN_BLOCKS;
    place(time.current);
  });

  return (
    <group>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} material={material} frustumCulled={false} />
      ))}
      {banks.map((g, i) => (
        <mesh key={`bank${i}`} geometry={g} material={bankMaterial} frustumCulled={false} />
      ))}
      {particles.length > 0 && (
        <instancedMesh key={particles.length} ref={spray} args={[cube, splashMaterial, particles.length]} frustumCulled={false} />
      )}
    </group>
  );
}

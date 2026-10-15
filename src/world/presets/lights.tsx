import { useFrame } from '@react-three/fiber';
import { useMemo, type MutableRefObject } from 'react';
import { AdditiveBlending, CanvasTexture, Sprite, SpriteMaterial } from 'three';

/** Soft round glow used by the campfire and by light presets. */
export function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

let shared: CanvasTexture | undefined;

/** Light presets (guidance_v2 Step 3.2). No real light sources: a glow sprite is cheap for any count. */
export const LIGHT_PRESETS = {
  /** Warm halo that fades in with the night factor. */
  lantern_glow: { color: '#FFC266', size: 0.9, opacity: 0.85 },
} as const;
export type LightPresetId = keyof typeof LIGHT_PRESETS;

export function LightGlow({ id, night, position }: { id: LightPresetId; night: MutableRefObject<number>; position: readonly [number, number, number] }) {
  const p = LIGHT_PRESETS[id];
  const sprite = useMemo(() => {
    shared ??= glowTexture();
    const s = new Sprite(new SpriteMaterial({ map: shared, color: p.color, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 }));
    s.scale.setScalar(p.size);
    return s;
  }, [p]);
  useFrame(() => {
    sprite.material.opacity = night.current * p.opacity;
    sprite.visible = night.current > 0.01;
  });
  return <primitive object={sprite} position={position} />;
}

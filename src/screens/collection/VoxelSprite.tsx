import { useEffect, useRef } from 'react';
import { resolveColors } from '../../assets/voxels/types';
import { modelById } from '../../world/voxel/geometry';
import { colors } from '../../ui/tokens';

interface Props {
  modelId: string;
  /** Rendered as a solid shape (not collected yet). */
  silhouette?: boolean;
  /** CSS size in px. */
  size?: number;
}

/** 2D pixel-art sprite: front view (looking toward -Z) of a voxel model, nearest-neighbor scaled. */
export function VoxelSprite({ modelId, silhouette, size = 96 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const model = modelById(modelId);
    const palette = resolveColors(model);
    const [W, H] = model.size;
    const px = Math.max(1, Math.floor(size / Math.max(W, H)));
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    // For each (x, y) keep the voxel closest to the viewer (highest z).
    const front = new Map<string, { z: number; c: number }>();
    for (const [x, y, z, c] of model.voxels) {
      const k = `${x},${y}`;
      const seen = front.get(k);
      if (!seen || z > seen.z) front.set(k, { z, c });
    }
    const offX = Math.floor((size - W * px) / 2);
    const offY = Math.floor((size - H * px) / 2);
    for (const [k, { c }] of front) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      ctx.fillStyle = silhouette ? colors.muteSoft : (palette[c] as string);
      ctx.fillRect(offX + x * px, offY + (H - 1 - y) * px, px, px);
    }
  }, [modelId, silhouette, size]);

  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size, imageRendering: 'pixelated' }} aria-hidden="true" />;
}

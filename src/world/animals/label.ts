import { CanvasTexture, SRGBColorSpace } from 'three';

const HEIGHT = 64;
const PAD = 18;
const FONT = `700 ${HEIGHT / 2}px 'Inter Variable', Inter, system-ui, sans-serif`;
const cache = new Map<string, { texture: CanvasTexture; aspect: number }>();

/** A white rounded label with dark text (poke bubble, DESIGN.md 18). Cached per text; there are only a few dozen. */
export function labelTexture(text: string): { texture: CanvasTexture; aspect: number } {
  const hit = cache.get(text);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = FONT;
  canvas.width = Math.ceil(ctx.measureText(text).width) + PAD * 2;
  canvas.height = HEIGHT;
  ctx.font = FONT; // resizing resets the context
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, HEIGHT, 12);
  ctx.fill();
  ctx.fillStyle = '#1E1E1E';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, HEIGHT / 2 + 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const label = { texture, aspect: canvas.width / HEIGHT };
  cache.set(text, label);
  return label;
}

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type MutableRefObject } from 'react';
import { MathUtils, type OrthographicCamera } from 'three';
import { config } from '../../domain/config';
import type { WorldMode } from '../types';

/** Isometric elevation: atan(1/√2) ≈ 35.264° (DESIGN.md 13). */
export const ELEVATION = Math.atan(1 / Math.SQRT2);
const BASE_AZIMUTH = Math.PI / 4;
const DISTANCE = 80;
const RATE = 5; // damping rate, ~99% settled after 1s

export interface CameraControls {
  azimuth: number; // radians offset from the isometric default, Home only
  zoom: number; // user zoom factor, Home only
  /** The offset the camera actually shows this frame (damped); the sun and clouds turn with it. */
  shown?: number;
}

interface Insets {
  right: number;
  bottom: number;
}

/** Screen area covered by floating panels, so the island stays visible next to them. */
export function insetsFor(mode: WorldMode, width: number, height: number): Insets {
  if (mode === 'home') return { right: 0, bottom: Math.min(200, height * 0.28) };
  if (mode === 'break') return width >= 992 ? { right: 460, bottom: 0 } : { right: 0, bottom: Math.min(520, height * 0.58) };
  return { right: 0, bottom: 0 };
}

interface Props {
  mode: WorldMode;
  side: number;
  depth: number;
  /** Highest terrain top above y = 0. */
  rise: number;
  reducedMotion: boolean;
  controls: MutableRefObject<CameraControls>;
}

export function CameraRig({ mode, side, depth, rise, reducedMotion, controls }: Props) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const cur = useRef({ zoom: 0, azimuth: BASE_AZIMUTH, right: 0, bottom: 0, init: false });
  const applied = useRef({ zoom: -1, right: -1, bottom: -1 });
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Home: one finger (or the mouse) drags to rotate within ±135°; two fingers pinch, or the wheel, zoom
  // within limits (Step 6.4).
  useEffect(() => {
    const el = gl.domElement;
    const limit = MathUtils.degToRad(config.render.azimuthLimitDeg);
    const pointers = new Map<number, { x: number; y: number }>();
    let lastX = 0;
    let pinch = 0;
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const zoomBy = (factor: number) => {
      controls.current.zoom = MathUtils.clamp(controls.current.zoom * factor, config.render.zoomMin, config.render.zoomMax);
      invalidate();
    };
    const down = (e: PointerEvent) => {
      if (modeRef.current !== 'home') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture(e.pointerId);
      lastX = e.clientX;
      pinch = pointers.size === 2 ? spread() : 0;
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2) {
        const d = spread();
        if (pinch > 0 && d > 0) zoomBy(d / pinch);
        pinch = d;
        return;
      }
      controls.current.azimuth = MathUtils.clamp(controls.current.azimuth - (e.clientX - lastX) * 0.005, -limit, limit);
      lastX = e.clientX;
      invalidate();
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      pinch = 0;
      // The finger left on the screen keeps rotating from where it is, without a jump.
      const rest = [...pointers.values()][0];
      if (rest) lastX = rest.x;
    };
    const wheel = (e: WheelEvent) => {
      if (modeRef.current !== 'home') return;
      zoomBy(Math.exp(-e.deltaY * 0.001));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl, controls, invalidate]);

  useFrame((_, delta) => {
    const c = cur.current;

    // Fit the island (plus tallest animals) with a margin, in pixels per world unit.
    const width = side * Math.SQRT2;
    const height = side * Math.SQRT2 * Math.sin(ELEVATION) + (1 + rise + depth * config.render.undersideFit) * Math.cos(ELEVATION) + 0.6;
    const insets = insetsFor(mode, size.width, size.height);
    const availW = Math.max(120, size.width - insets.right);
    const availH = Math.max(120, size.height - insets.bottom);
    const fit = Math.min(availW / width, availH / height) / (1 + config.render.fitMargin);

    const home = mode === 'home';
    const targetZoom = fit * (home ? controls.current.zoom : 1) * (mode === 'focus' ? config.render.focusZoomFactor : 1);
    const targetAzimuth = BASE_AZIMUTH + (home ? controls.current.azimuth : 0);

    const k = reducedMotion || !c.init ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * RATE);
    c.zoom += (targetZoom - c.zoom) * k;
    c.azimuth += (targetAzimuth - c.azimuth) * k;
    c.right += (insets.right - c.right) * k;
    c.bottom += (insets.bottom - c.bottom) * k;
    c.init = true;
    controls.current.shown = c.azimuth - BASE_AZIMUTH;

    const targetY = (1 + rise - depth * config.render.undersideFit) / 2;
    camera.position.set(
      Math.cos(ELEVATION) * Math.sin(c.azimuth) * DISTANCE,
      targetY + Math.sin(ELEVATION) * DISTANCE,
      Math.cos(ELEVATION) * Math.cos(c.azimuth) * DISTANCE,
    );
    camera.lookAt(0, targetY, 0);

    const a = applied.current;
    if (Math.abs(a.zoom - c.zoom) > 1e-3 || Math.abs(a.right - c.right) > 0.05 || Math.abs(a.bottom - c.bottom) > 0.05) {
      camera.zoom = c.zoom;
      // Shift the view so the island centers in the area not covered by panels.
      camera.setViewOffset(size.width, size.height, c.right / 2, c.bottom / 2, size.width, size.height);
      camera.updateProjectionMatrix();
      a.zoom = c.zoom;
      a.right = c.right;
      a.bottom = c.bottom;
    }
  });

  return null;
}

import type { Object3D } from 'three';

/**
 * Part animation presets (guidance_v2 Step 3.2): a model part (e.g. `blade`) is drawn in its own group
 * placed at the part's pivot; the preset moves that group. `t` is scaled seconds; `phase` (0..1)
 * keeps several copies of one building out of step.
 */
export type PartAnimation = (part: Object3D, t: number, phase: number) => void;

const TAU = Math.PI * 2;

export const PART_PRESETS: Readonly<Record<string, PartAnimation>> = {
  /** Turns around the part's forward axis (windmill blade): one turn every 4 s. */
  spin: (p, t, phase) => {
    p.rotation.z = (t / 4 + phase) * TAU;
  },
  /** Gentle side-to-side lean (flags, plants). */
  sway: (p, t, phase) => {
    p.rotation.z = Math.sin((t / 2.5 + phase) * TAU) * 0.08;
  },
  /** Up and down by 1/20 block. */
  bob: (p, t, phase) => {
    p.position.y = (p.userData.baseY ?? 0) + Math.sin((t / 2 + phase) * TAU) * 0.05;
  },
  /** Quick wing beat around the x axis. */
  flap: (p, t, phase) => {
    p.rotation.x = Math.sin((t * 3 + phase) * TAU) * 0.5;
  },
};

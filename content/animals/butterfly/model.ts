import { defineModel, type ModelPalette, type VoxelBuilder } from '../../../tools/content-build/animal';

// Butterfly: flat, wings spread in the horizontal plane (seen from above by the isometric camera).
// This rest pose is used by sprites and the reward card; for the `flutter` idle the world splits it into
// the body (two center columns) and the left wing, mirrored for the right one, so the wings can flap (ADR-024).
const palette: ModelPalette = {
  1: ['wing', '#FF9A3C'], // upper wings
  2: ['accent', '#7EC8FF'], // lower wings
  3: ['body', '#3A2A22'], // body
  4: ['accent2', '#FFFFFF'], // wing spot
  5: ['eye', '#1E1E1E'], // eyes, antennae
};

/** One wing with the inner edge at x = 1: scalloped upper (orange) and lower (sky) lobes. `m` also draws the mirror. */
const wing = (b: VoxelBuilder, y: number, m: boolean) => {
  const box = m ? b.boxM : b.box;
  box(1, y, 3, 1, 1, 3, 1); // upper lobe, inner
  box(0, y, 3, 1, 1, 2, 1); // upper lobe, outer
  box(1, y, 0, 1, 1, 3, 2); // lower lobe, inner
  box(0, y, 1, 1, 1, 1, 2); // lower lobe, outer
  (m ? b.setM : b.set)(0, y, 4, 4); // spot
};

/** Body, head and antennae on `x0..x0+1`. */
const body = (b: VoxelBuilder, x0: number) => {
  b.box(x0, 0, 0, 2, 2, 5, 3); // body
  b.box(x0, 0, 5, 2, 2, 1, 3); // head
  b.box(x0, 2, 5, 2, 1, 1, 5); // antennae
};

export default defineModel([6, 3, 6], palette, (b) => {
  wing(b, 1, true);
  body(b, 2);
});

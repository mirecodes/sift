import { defineModel } from '../../../tools/content-build/animal';

// Beetle: glossy dark brown wing cases that open, six little legs and a horn on the head.
export default defineModel([6, 4, 7], {
  1: ['body', '#5B3A22'], // shell
  2: ['accent', '#8A5A36'], // shine, horn
  3: ['eye', '#1E1E1E'], // eyes, legs, underside
}, (b) => {
  b.box(1, 0, 1, 4, 1, 5, 3); // underside
  for (const z of [1, 3, 5]) b.setM(0, 0, z, 3); // legs
  b.pair('wing', [2.5, 2.5, 3], () => {
    b.box(1, 1, 1, 2, 2, 5, 1);
    b.box(2, 2, 2, 1, 1, 3, 2); // shine along the seam
  });
  b.part('head', [2.5, 1, 5.5], () => {
    b.box(2, 0, 6, 2, 2, 1, 1);
    b.set(2, 1, 6, 3); // eyes
    b.set(3, 1, 6, 3);
    b.box(2, 2, 6, 2, 1, 1, 2); // horn
    b.box(2, 3, 5, 2, 1, 1, 2);
  });
});

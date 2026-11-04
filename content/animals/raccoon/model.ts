import { defineModel } from '../../../tools/content-build/animal';

// Raccoon: grey body, dark paws, a ringed bushy tail, white brow and muzzle around a black eye mask.
export default defineModel([5, 5, 8], {
  1: ['body', '#8A8F98'], // fur
  2: ['accent', '#2B2B2B'], // mask, rings, paws, nose
  3: ['muzzle', '#EDEDED'], // brow, muzzle
  4: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.pair('legF', [1, 0.5, 5], () => b.box(1, 0, 5, 1, 1, 1, 2));
  b.pair('legB', [1, 0.5, 2], () => b.box(1, 0, 2, 1, 1, 1, 2));
  b.box(1, 1, 2, 3, 2, 4, 1); // body
  b.part('tail', [2, 1.5, 1.5], () => {
    b.box(1, 1, 0, 3, 2, 2, 1);
    b.box(1, 1, 1, 3, 2, 1, 2); // ring
    b.box(2, 1, 0, 1, 1, 1, 2); // tip
  });
  b.part('head', [2, 2.5, 5.5], () => {
    b.box(1, 2, 6, 3, 3, 2, 1);
    b.box(1, 4, 7, 3, 1, 1, 3); // brow
    b.box(1, 3, 7, 3, 1, 1, 2); // mask
    b.setM(1, 3, 7, 4); // eyes
    b.box(1, 2, 7, 3, 1, 1, 3); // muzzle
    b.set(2, 2, 7, 2); // nose
    b.setM(0, 4, 6, 1); // ears
  });
});

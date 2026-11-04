import { defineModel } from '../../../tools/content-build/animal';

// Cat: orange tabby with a wide head, pointed ears, white muzzle and a striped tail that curls at the tip.
export default defineModel([5, 7, 8], {
  1: ['body', '#E8993E'], // fur
  2: ['accent', '#B96A22'], // stripes, ear tips
  3: ['muzzle', '#FFF3E0'], // muzzle, paws
  4: ['eye', '#1E1E1E'], // eyes
  5: ['nose', '#F4A6B7'], // nose
}, (b) => {
  b.pair('legF', [1, 1.5, 5], () => {
    b.box(1, 0, 5, 1, 2, 1, 1);
    b.set(1, 0, 5, 3); // paw
  });
  b.pair('legB', [1, 1.5, 1], () => b.box(1, 0, 1, 1, 2, 1, 1));
  b.box(1, 2, 1, 3, 2, 5, 1); // body
  for (const z of [2, 4]) b.box(1, 3, z, 3, 1, 1, 2); // stripes
  b.part('tail', [2, 3, 0.5], () => b.box(2, 3, 0, 1, 1, 1, 1));
  b.part('tail2', [2, 3.5, 0], () => {
    b.box(2, 4, 0, 1, 3, 1, 1);
    b.set(2, 5, 0, 2);
  });
  b.part('head', [2, 3.5, 5], () => {
    b.box(0, 3, 5, 5, 2, 3, 1); // wide head
    b.box(1, 5, 5, 3, 1, 2, 1);
    b.box(1, 5, 5, 3, 1, 1, 2); // forehead stripe
    b.box(1, 3, 7, 3, 1, 1, 3); // muzzle
    b.setM(1, 4, 7, 4); // eyes
    b.set(2, 4, 7, 5); // nose
  });
  b.pair('ear', [0.5, 4.5, 6], () => {
    b.box(0, 5, 6, 1, 1, 1, 1);
    b.set(0, 6, 6, 2);
  });
});

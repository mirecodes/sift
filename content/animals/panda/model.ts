import { defineModel } from '../../../tools/content-build/animal';

// Panda: round white body with black legs and shoulder band, black eye patches and ears, chewing a
// bamboo stalk held across its mouth.
export default defineModel([7, 8, 11], {
  1: ['body', '#F7F7F7'], // white fur
  2: ['eye', '#1E1E1E'], // black fur, eye patches, nose
  3: ['prop', '#7BC950'], // bamboo
  4: ['prop2', '#4E9A3A'], // leaf
}, (b) => {
  b.pair('legF', [1.5, 2.5, 6.5], () => b.box(1, 0, 6, 2, 3, 2, 2));
  b.pair('legB', [1.5, 2.5, 1.5], () => b.box(1, 0, 1, 2, 3, 2, 2));
  b.box(1, 3, 1, 5, 4, 7, 1); // body
  b.box(1, 3, 6, 5, 3, 1, 2); // shoulder band
  b.part('tail', [3, 5, 0.5], () => b.set(3, 5, 0, 1));
  b.part('head', [3, 5, 7.5], () => {
    b.box(1, 4, 8, 5, 3, 2, 1);
    b.box(2, 4, 10, 3, 1, 1, 1); // muzzle
    b.set(3, 5, 10, 2); // nose
    b.boxM(1, 5, 9, 2, 1, 1, 2); // eye patches
    b.box(0, 4, 10, 7, 1, 1, 3); // bamboo
    b.set(0, 5, 10, 4); // leaf
  });
  b.pair('ear', [1.5, 6.5, 8.5], () => b.box(1, 7, 8, 1, 1, 1, 2));
});

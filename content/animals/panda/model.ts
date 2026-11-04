import { defineModel } from '../../../tools/content-build/animal';

// Panda: round black-and-white panda sitting up, hugging a bamboo stalk with both arms, black ears and
// eye patches. The original sitting design, now with a head that turns and arms that munch and wave.
export default defineModel([5, 8, 6], {
  1: ['body', '#F7F7F7'], // fur
  2: ['eye', '#1E1E1E'], // arms, legs, ears, eye patches, nose
  3: ['prop', '#7BC950'], // bamboo
  4: ['prop2', '#4E9A3A'], // bamboo leaves
}, (b) => {
  b.box(0, 0, 0, 5, 4, 4, 1); // round sitting body
  b.erase(0, 3, 0, 1, 1, 1);
  b.erase(4, 3, 0, 1, 1, 1);
  b.boxM(0, 1, 0, 1, 3, 3, 2); // dark shoulder bands
  b.pair('legB', [0.5, 0.5, 3.5], () => b.box(0, 0, 3, 2, 1, 2, 2)); // feet out in front
  b.box(2, 0, 5, 1, 6, 1, 3); // bamboo
  b.boxM(1, 5, 5, 1, 1, 1, 4); // leaves
  b.pair('legF', [1, 2.5, 3.5], () => b.box(1, 1, 4, 1, 2, 2, 2)); // arms hugging the bamboo
  b.part('head', [2, 3.5, 2], () => {
    b.box(0, 4, 0, 5, 3, 4, 1);
    b.erase(0, 6, 0, 1, 1, 1);
    b.erase(4, 6, 0, 1, 1, 1);
    b.boxM(1, 5, 3, 1, 2, 1, 2); // eye patches
    b.set(2, 4, 3, 2); // nose
  });
  b.pair('ear', [0.5, 6.5, 1], () => b.set(0, 7, 1, 2));
});

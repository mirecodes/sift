import { defineModel } from '../../../tools/content-build/animal';

// Lizard: flat green body on sprawled legs, a light stripe down the back, a long tail and eyes on top
// of a narrowing head.
export default defineModel([5, 3, 8], {
  1: ['body', '#8ED15B'], // skin
  2: ['accent', '#C8EE8E'], // back stripe
  3: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.pair('legF', [1, 0.5, 5], () => b.box(0, 0, 5, 1, 1, 1, 1));
  b.pair('legB', [1, 0.5, 2], () => b.box(0, 0, 2, 1, 1, 1, 1));
  b.box(1, 0, 2, 3, 2, 4, 1); // body
  b.box(2, 1, 2, 1, 1, 4, 2); // stripe
  b.part('tail', [2, 0.5, 1.5], () => {
    b.box(2, 0, 0, 1, 1, 2, 1);
  });
  b.part('head', [2, 1, 5.5], () => {
    b.box(1, 0, 6, 3, 2, 2, 1);
    b.erase(1, 1, 7, 1, 1, 1); // narrowing snout
    b.erase(3, 1, 7, 1, 1, 1);
    b.setM(1, 2, 6, 3); // eyes on top
  });
});

import { defineModel } from '../../../tools/content-build/animal';

// Wolf: long silver-grey body with a darker saddle, light belly and snout, pointed ears and a bushy
// tail. Sits to howl.
export default defineModel([6, 9, 12], {
  1: ['body', '#9AA3AE'], // fur
  2: ['belly', '#E6EAF0'], // belly, snout, tail tip
  3: ['eye', '#1E1E1E'], // eyes, nose
  4: ['accent', '#5B6470'], // saddle, ears
}, (b) => {
  b.pair('legF', [1, 2.5, 8], () => b.box(1, 0, 8, 1, 3, 1, 1));
  b.pair('legB', [1, 2.5, 3], () => b.box(1, 0, 3, 1, 3, 1, 1));
  b.box(1, 3, 2, 4, 3, 7, 1); // body
  b.box(1, 5, 3, 4, 1, 5, 4); // saddle
  b.box(2, 3, 7, 2, 2, 2, 2); // chest
  b.part('tail', [2.5, 5, 1.5], () => {
    b.box(2, 4, 0, 2, 2, 2, 1);
    b.box(2, 4, 0, 2, 1, 1, 2); // tip
  });
  b.part('head', [2.5, 5.5, 8.5], () => {
    b.box(1, 5, 9, 4, 3, 2, 1);
    b.box(2, 5, 11, 2, 2, 1, 2); // snout
    b.box(2, 6, 11, 2, 1, 1, 3); // nose
    b.setM(1, 7, 10, 3); // eyes
  });
  b.pair('ear', [1.5, 7.5, 9.5], () => b.box(1, 8, 9, 1, 1, 1, 4));
});

import { defineModel } from '../../../tools/content-build/animal';

// Frog: green crouching body, big hind legs at the sides, light chin and two bulging eyes.
export default defineModel([6, 4, 6], {
  1: ['body', '#5DBB4B'], // body
  2: ['belly', '#C9F0A8'], // chin
  3: ['accent', '#4A9E3C'], // legs
  4: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.box(1, 0, 0, 4, 2, 4, 1); // body
  b.pair('legB', [1, 0.5, 1], () => b.box(0, 0, 0, 2, 1, 2, 3));
  b.pair('legF', [1, 0.5, 4], () => b.box(0, 0, 4, 1, 1, 2, 3));
  b.part('head', [2.5, 1.5, 3], () => {
    b.box(1, 1, 3, 4, 2, 3, 1);
    b.box(1, 1, 5, 4, 1, 1, 2); // chin
    b.boxM(1, 3, 4, 1, 1, 1, 1); // eye bumps
    b.setM(1, 3, 5, 4); // eyes
  });
});

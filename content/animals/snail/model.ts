import { defineModel } from '../../../tools/content-build/animal';

// Snail: beige foot, a round brown shell with a spiral, a head with two eye stalks that looks around.
export default defineModel([3, 4, 7], {
  1: ['body', '#E8D5B0'], // body
  2: ['shell', '#9B6B43'], // shell
  3: ['eye', '#1E1E1E'], // eyes
  4: ['accent', '#C98F5A'], // shell spiral
}, (b) => {
  b.box(0, 0, 0, 3, 1, 5, 1); // foot
  b.box(0, 1, 1, 3, 3, 3, 2); // shell
  b.erase(0, 3, 1, 1, 1, 1);
  b.erase(2, 3, 1, 1, 1, 1);
  b.setM(0, 2, 2, 4); // spiral
  b.setM(0, 1, 3, 4);
  b.set(1, 3, 2, 4);
  b.part('head', [1, 0.5, 4.5], () => {
    b.box(0, 0, 5, 3, 2, 2, 1);
    b.setM(0, 2, 6, 1); // stalks
    b.setM(0, 3, 6, 3); // eyes on the tips
  });
});

import { defineModel } from './builder';

// Snail: beige body, brown spiral shell, two antennae with eyes on the tips.
export const snail = defineModel([3, 4, 6], {
  1: ['body', '#E8D5B0'], // body
  2: ['shell', '#9B6B43'], // shell
  3: ['eye', '#1E1E1E'], // eye
  4: ['accent', '#C98F5A'], // shell spiral
}, (b) => {
  b.box(0, 0, 0, 3, 1, 5, 1); // foot
  b.box(1, 1, 5, 1, 2, 1, 1); // neck
  b.setM(0, 2, 5, 1); // antennae
  b.setM(0, 3, 5, 3); // eyes
  b.box(0, 1, 1, 3, 3, 3, 2); // shell
  b.setM(0, 2, 2, 4); // spiral
  b.set(1, 3, 2, 4);
});

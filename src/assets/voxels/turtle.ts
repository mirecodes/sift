import { defineModel } from './builder';

// Turtle: green skin, dark shell with a light lime top pattern.
export const turtle = defineModel([5, 3, 6], {
  1: ['body', '#8FD36B'], // skin
  2: ['shell', '#4E9A3A'], // shell
  3: ['accent', '#C5E87D'], // shell top
  4: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.boxM(0, 0, 0, 1, 1, 1, 1); // hind feet
  b.boxM(0, 0, 3, 1, 1, 2, 1); // front feet
  b.box(0, 1, 0, 5, 1, 5, 2); // shell base
  b.box(1, 2, 1, 3, 1, 3, 3); // shell top
  b.set(2, 2, 2, 2);
  b.box(1, 1, 5, 3, 2, 1, 1); // head
  b.setM(1, 2, 5, 4); // eyes
});

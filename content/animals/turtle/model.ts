import { defineModel } from '../../../tools/content-build/animal';

// Turtle: a domed dark green shell with a light top pattern, flippers to the sides, a head that hides.
export default defineModel([7, 3, 8], {
  1: ['body', '#8FD36B'], // skin
  2: ['shell', '#4E9A3A'], // shell
  3: ['accent', '#C5E87D'], // shell top
  4: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.box(2, 0, 2, 3, 1, 4, 1); // underside
  b.box(1, 1, 1, 5, 1, 6, 2); // shell rim
  b.box(2, 2, 2, 3, 1, 4, 2); // dome
  b.box(3, 2, 3, 1, 1, 2, 3); // pattern
  b.setM(2, 2, 2, 3);
  b.setM(2, 2, 5, 3);
  b.pair('legF', [1.5, 0.5, 5], () => b.box(0, 0, 5, 2, 1, 1, 1));
  b.pair('legB', [1.5, 0.5, 2], () => b.box(0, 0, 2, 2, 1, 1, 1));
  b.part('tail', [3, 0.5, 1.5], () => b.set(3, 0, 1, 1));
  b.part('head', [3, 0.5, 6], () => {
    b.box(2, 0, 6, 3, 2, 2, 1);
    b.setM(2, 1, 7, 4); // eyes
  });
});

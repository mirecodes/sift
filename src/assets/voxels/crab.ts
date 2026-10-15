import { defineModel } from './builder';

// Crab: vermilion body, raised open claws on both sides, eyes on top.
export const crab = defineModel([6, 4, 5], {
  1: ['body', '#F0563B'], // shell
  2: ['accent', '#C93A28'], // legs, claws
  3: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.boxM(0, 0, 1, 2, 1, 1, 2); // legs
  b.boxM(0, 0, 3, 2, 1, 1, 2);
  b.box(1, 1, 0, 4, 2, 4, 1); // body
  b.boxM(0, 2, 3, 1, 2, 2, 2); // claws
  b.erase(0, 3, 4, 1, 1, 1); // open the pincers
  b.erase(5, 3, 4, 1, 1, 1);
  b.setM(2, 3, 3, 3); // eyes
});

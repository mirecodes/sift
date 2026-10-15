import { defineModel } from './builder';

// Fox: orange body, white chest and tail tip, dark legs and ear tips.
export const fox = defineModel([3, 7, 6], {
  1: ['body', '#E8702A'], // fur
  2: ['belly', '#FFFFFF'], // chest, muzzle, tail tip
  3: ['accent', '#3A2A22'], // legs, ears, nose
  4: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.boxM(0, 0, 2, 1, 2, 1, 3); // hind legs
  b.boxM(0, 0, 4, 1, 2, 1, 3); // front legs
  b.box(0, 2, 2, 3, 2, 3, 1); // body
  b.box(0, 2, 0, 3, 3, 2, 1); // tail
  b.box(0, 2, 0, 3, 3, 1, 2); // tail tip
  b.box(0, 3, 4, 3, 3, 2, 1); // head
  b.box(0, 2, 5, 3, 1, 1, 2); // chest
  b.box(0, 3, 5, 3, 1, 1, 2); // muzzle
  b.set(1, 3, 5, 3); // nose
  b.setM(0, 4, 5, 4); // eyes
  b.boxM(0, 6, 4, 1, 1, 1, 3); // ears
});

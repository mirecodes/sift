import { defineModel } from '../../../tools/content-build/animal';

// Fox: slim orange body on dark legs, a white chest, a big bushy tail with a white tip, a pointed head
// with a white muzzle and dark ears.
export default defineModel([5, 7, 11], {
  1: ['body', '#E8702A'], // fur
  2: ['belly', '#FFFFFF'], // chest, muzzle, tail tip
  3: ['accent', '#3A2A22'], // legs, ears, nose
  4: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.pair('legF', [1, 1.5, 7], () => b.box(1, 0, 7, 1, 2, 1, 3));
  b.pair('legB', [1, 1.5, 3], () => b.box(1, 0, 3, 1, 2, 1, 3));
  b.box(1, 2, 3, 3, 2, 5, 1); // body
  b.box(2, 2, 6, 1, 2, 2, 2); // chest
  b.part('tail', [2, 3, 2.5], () => b.box(1, 2, 1, 3, 2, 2, 1));
  b.part('tail2', [2, 3, 0.5], () => b.box(1, 2, 0, 3, 2, 1, 2)); // white tip
  b.part('head', [2, 3.5, 7.5], () => {
    b.box(1, 4, 7, 3, 2, 2, 1);
    b.box(1, 4, 9, 3, 1, 1, 2); // muzzle
    b.set(2, 4, 10, 3); // nose
    b.setM(1, 5, 9, 4); // eyes
  });
  b.pair('ear', [1, 5.5, 7.5], () => b.box(1, 6, 7, 1, 1, 1, 3));
});

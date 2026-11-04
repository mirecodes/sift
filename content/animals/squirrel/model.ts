import { defineModel } from '../../../tools/content-build/animal';

// Squirrel: orange-brown body, a big bushy tail in two parts curling up behind, light muzzle, perky ears.
export default defineModel([5, 5, 7], {
  1: ['body', '#C8743A'], // fur
  2: ['muzzle', '#F3DDBB'], // muzzle, belly
  3: ['eye', '#1E1E1E'], // eyes
  4: ['accent', '#E8A56B'], // tail tip
}, (b) => {
  b.pair('legF', [1, 0.5, 4], () => b.box(1, 0, 4, 1, 1, 1, 1));
  b.pair('legB', [1, 0.5, 2.5], () => b.box(1, 0, 2, 1, 1, 2, 1));
  b.box(1, 1, 2, 3, 2, 3, 1); // body
  b.box(2, 1, 4, 1, 1, 1, 2); // belly
  b.part('tail', [2, 1.5, 1.5], () => b.box(1, 1, 0, 3, 2, 2, 1));
  b.part('tail2', [2, 2.5, 0.5], () => {
    b.box(1, 3, 0, 3, 2, 1, 1);
    b.box(1, 4, 1, 3, 1, 1, 4); // tip curling forward
  });
  b.part('head', [2, 2.5, 4], () => {
    b.box(1, 2, 4, 3, 2, 2, 1);
    b.set(2, 2, 6, 2); // muzzle
    b.setM(1, 3, 5, 3); // eyes
    b.setM(1, 4, 4, 1); // ears
  });
});

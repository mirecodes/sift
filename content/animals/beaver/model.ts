import { defineModel } from '../../../tools/content-build/animal';

// Beaver: chunky brown body, a flat dark paddle tail, light muzzle with two white front teeth.
export default defineModel([5, 5, 8], {
  1: ['body', '#8B5A2B'], // fur
  2: ['accent', '#5E3B20'], // tail, feet, nose
  3: ['eye', '#1E1E1E'], // eyes
  4: ['accent2', '#FFFFFF'], // teeth
  5: ['belly', '#C9A36B'], // muzzle
}, (b) => {
  b.pair('legF', [1, 0.5, 5], () => b.box(1, 0, 5, 1, 1, 1, 2));
  b.pair('legB', [1, 0.5, 2], () => b.box(1, 0, 2, 1, 1, 1, 2));
  b.box(0, 1, 2, 5, 3, 4, 1); // body
  b.erase(0, 3, 2, 1, 1, 4);
  b.erase(4, 3, 2, 1, 1, 4);
  b.part('tail', [2, 1.5, 1.5], () => b.box(1, 1, 0, 3, 1, 2, 2)); // flat paddle
  b.part('head', [2, 2.5, 5.5], () => {
    b.box(1, 1, 6, 3, 3, 2, 1);
    b.box(1, 1, 7, 3, 2, 1, 5); // muzzle
    b.set(2, 2, 7, 2); // nose
    b.set(2, 1, 7, 4); // teeth
    b.setM(1, 3, 7, 3); // eyes
    b.setM(1, 4, 6, 1); // ears
  });
});

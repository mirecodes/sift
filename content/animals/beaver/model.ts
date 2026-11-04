import { defineModel } from '../../../tools/content-build/animal';

// Beaver: chubby brown body, a flat dark paddle tail, a round head with a light muzzle sticking out,
// two white front teeth.
export default defineModel([5, 5, 8], {
  1: ['body', '#8B5A2B'], // fur
  2: ['accent', '#5E3B20'], // tail, feet, nose
  3: ['eye', '#1E1E1E'], // eyes
  4: ['accent2', '#FFFFFF'], // teeth
  5: ['belly', '#C9A36B'], // muzzle
}, (b) => {
  b.pair('legF', [1, 0.5, 4], () => b.box(1, 0, 4, 1, 1, 1, 2));
  b.pair('legB', [1, 0.5, 2], () => b.box(1, 0, 2, 1, 1, 1, 2));
  b.box(1, 1, 1, 3, 3, 5, 1); // body
  b.erase(1, 3, 1, 1, 1, 1);
  b.erase(3, 3, 1, 1, 1, 1);
  b.part('tail', [2, 1.5, 0.5], () => b.box(1, 1, 0, 3, 1, 1, 2)); // flat paddle
  b.part('head', [2, 2.5, 5], () => {
    b.box(1, 1, 5, 3, 3, 2, 1);
    b.box(1, 1, 7, 3, 2, 1, 5); // muzzle, sticking out
    b.set(2, 2, 7, 2); // nose
    b.set(2, 1, 7, 4); // teeth
    b.setM(1, 3, 6, 3); // eyes, set back from the nose
    b.setM(1, 4, 5, 1); // ears
  });
});

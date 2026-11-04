import { defineModel } from '../../../tools/content-build/animal';

// Beaver: brown body, flat dark tail and two white front teeth.
export default defineModel([5, 6, 6], {
  1: ['body', '#8B5A2B'], // fur
  2: ['accent', '#5E3B20'], // tail
  3: ['eye', '#1E1E1E'], // eye, nose
  4: ['accent2', '#FFFFFF'], // teeth
  5: ['belly', '#C9A36B'], // belly, muzzle
}, (b) => {
  b.box(1, 0, 0, 3, 2, 1, 2); // tail
  b.box(0, 0, 1, 5, 3, 4, 1); // body
  b.box(1, 0, 4, 3, 2, 1, 5); // belly
  b.box(0, 3, 2, 5, 2, 3, 1); // head
  b.box(1, 3, 5, 3, 2, 1, 5); // muzzle
  b.set(2, 4, 5, 3); // nose
  b.set(2, 3, 5, 4); // teeth
  b.set(2, 2, 5, 4);
  b.boxM(0, 5, 2, 1, 1, 1, 1); // ears
  b.setM(1, 4, 4, 3); // eyes
});

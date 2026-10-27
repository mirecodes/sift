import { defineModel } from '../../../tools/content-build/animal';

// Ferret: long cream body with a brown bandit mask, brown feet and nose.
export default defineModel([3, 5, 6], {
  1: ['body', '#F2DDB8'], // fur
  2: ['accent', '#7A5230'], // mask, feet, nose
  3: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.boxM(0, 0, 0, 1, 1, 1, 2); // feet
  b.boxM(0, 0, 3, 1, 1, 1, 2);
  b.box(0, 1, 0, 3, 2, 4, 1); // body
  b.box(1, 3, 0, 1, 1, 1, 2); // tail
  b.box(0, 2, 4, 3, 2, 2, 1); // head
  b.box(0, 3, 5, 3, 1, 1, 2); // mask
  b.setM(0, 3, 5, 3); // eyes
  b.set(1, 2, 5, 2); // nose
  b.boxM(0, 4, 4, 1, 1, 1, 2); // ears
});

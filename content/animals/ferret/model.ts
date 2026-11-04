import { defineModel } from '../../../tools/content-build/animal';

// Ferret: long low cream body, raised head with a brown bandit mask, brown feet and a dark-tipped tail.
export default defineModel([5, 4, 8], {
  1: ['body', '#F2DDB8'], // fur
  2: ['accent', '#7A5230'], // mask, feet, nose, tail tip
  3: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.pair('legF', [1, 0.5, 5], () => b.box(1, 0, 5, 1, 1, 1, 2));
  b.pair('legB', [1, 0.5, 2], () => b.box(1, 0, 2, 1, 1, 1, 2));
  b.box(1, 1, 2, 3, 2, 5, 1); // long body
  b.part('tail', [2, 1.5, 1.5], () => {
    b.box(2, 1, 0, 1, 1, 2, 1);
    b.set(2, 1, 0, 2); // dark tip
  });
  b.part('head', [2, 2, 6], () => {
    b.box(1, 2, 6, 3, 2, 2, 1);
    b.box(1, 3, 7, 3, 1, 1, 2); // mask
    b.setM(1, 3, 7, 3); // eyes in the mask
    b.set(2, 2, 7, 2); // nose
    b.setM(1, 3, 6, 1); // ears
  });
});

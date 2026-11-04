import { defineModel } from '../../../tools/content-build/animal';

// Hamster: a chubby round tan ball with puffed white cheeks, pink ears and tiny feet.
export default defineModel([5, 4, 5], {
  1: ['body', '#E0B27A'], // fur
  2: ['belly', '#FFFFFF'], // cheeks, belly
  3: ['nose', '#F4A6B7'], // ears, nose
  4: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.pair('legF', [1, 0.5, 3], () => b.box(1, 0, 3, 1, 1, 1, 2));
  b.pair('legB', [1, 0.5, 1], () => b.box(1, 0, 1, 1, 1, 1, 1));
  b.box(0, 1, 0, 5, 2, 3, 1); // body
  b.box(1, 3, 0, 3, 1, 3, 1); // back
  b.erase(0, 2, 0, 1, 1, 1);
  b.erase(4, 2, 0, 1, 1, 1);
  b.part('head', [2, 2, 2.5], () => {
    b.box(0, 1, 3, 5, 2, 2, 1);
    b.box(1, 3, 3, 3, 1, 2, 1);
    b.boxM(0, 1, 4, 1, 2, 1, 2); // puffed cheeks
    b.box(1, 1, 4, 3, 1, 1, 2); // chin
    b.setM(1, 3, 4, 4); // eyes
    b.set(2, 2, 4, 3); // nose
    b.setM(0, 3, 3, 3); // ears
  });
});

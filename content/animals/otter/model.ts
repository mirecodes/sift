import { defineModel } from '../../../tools/content-build/animal';

// Otter: dark brown, sitting up with a light belly and muzzle, front paws holding a pink clam shell.
export default defineModel([5, 7, 5], {
  1: ['body', '#6B4A32'], // fur
  2: ['belly', '#D7B58E'], // belly, muzzle
  3: ['eye', '#1E1E1E'], // eyes, nose
  4: ['prop', '#F4A6B7'], // clam
}, (b) => {
  b.pair('legB', [1, 0.5, 3], () => b.box(1, 0, 3, 1, 1, 2, 1)); // feet forward
  b.box(1, 0, 1, 3, 4, 3, 1); // upright body
  b.box(1, 1, 3, 3, 3, 1, 2); // belly
  b.set(2, 2, 4, 4); // clam
  b.pair('legF', [1, 3.5, 3.5], () => b.box(1, 2, 4, 1, 2, 1, 1)); // paws holding it
  b.part('tail', [2, 0.5, 0.5], () => b.box(2, 0, 0, 1, 1, 1, 1));
  b.part('head', [2, 3.5, 2], () => {
    b.box(1, 4, 1, 3, 3, 3, 1);
    b.box(1, 4, 3, 3, 1, 1, 2); // muzzle
    b.set(2, 4, 3, 3); // nose, in the muzzle
    b.setM(1, 6, 3, 3); // eyes, a row above
    b.setM(0, 6, 2, 1); // ears
  });
});

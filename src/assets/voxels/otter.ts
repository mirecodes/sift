import { defineModel } from './builder';

// Otter: dark brown, sitting up with a pink clam shell held on its belly.
export const otter = defineModel([4, 6, 5], {
  1: ['body', '#6B4A32'], // fur
  2: ['belly', '#D7B58E'], // belly, muzzle
  3: ['eye', '#1E1E1E'], // eye
  4: ['prop', '#F4A6B7'], // clam shell
}, (b) => {
  b.box(0, 0, 0, 4, 3, 4, 1); // body
  b.box(1, 1, 3, 2, 2, 1, 2); // belly
  b.box(1, 1, 4, 2, 1, 1, 4); // clam
  b.boxM(0, 1, 4, 1, 1, 1, 1); // paws
  b.box(0, 3, 0, 4, 2, 4, 1); // head
  b.box(1, 3, 3, 2, 1, 2, 2); // muzzle
  b.setM(0, 4, 3, 3); // eyes
  b.boxM(0, 5, 1, 1, 1, 1, 1); // ears
});

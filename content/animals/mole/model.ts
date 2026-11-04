import { defineModel } from '../../../tools/content-build/animal';

// Mole: dark grey body, pink nose and big tan digging paws.
export default defineModel([5, 3, 6], {
  1: ['body', '#5A5F6B'], // fur
  2: ['nose', '#F4A6B7'], // nose
  3: ['eye', '#1E1E1E'], // eye
  4: ['accent', '#E8B58A'], // paws
}, (b) => {
  b.box(0, 0, 0, 5, 2, 4, 1); // body
  b.box(1, 2, 0, 3, 1, 4, 1); // back
  b.box(1, 0, 4, 3, 3, 2, 1); // head
  b.box(2, 0, 5, 1, 2, 1, 2); // nose
  b.setM(1, 2, 5, 3); // eyes
  b.boxM(0, 0, 4, 1, 2, 2, 4); // paws
});

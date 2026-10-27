import { defineModel } from '../../../tools/content-build/animal';

// Mouse: small grey body, big pink ears, thin pink tail.
export default defineModel([3, 3, 6], {
  1: ['body', '#B8BCC4'], // fur
  2: ['nose', '#F4A6B7'], // ears, nose, tail
  3: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.box(0, 0, 1, 3, 2, 3, 1); // body
  b.box(0, 0, 4, 3, 2, 2, 1); // head
  b.boxM(0, 2, 3, 1, 1, 2, 1); // ears
  b.setM(0, 2, 4, 2); // inner ears
  b.set(1, 0, 5, 2); // nose
  b.setM(0, 1, 5, 3); // eyes
  b.box(1, 0, 0, 1, 2, 1, 2); // tail
});

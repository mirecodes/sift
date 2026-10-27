import { defineModel } from '../../../tools/content-build/animal';

// Koala: grey body, big round ears with light insides, tall dark nose.
export default defineModel([5, 6, 5], {
  1: ['body', '#9EA4AE'], // fur
  2: ['belly', '#E6E8EC'], // belly, inner ears
  3: ['eye', '#1E1E1E'], // eye, nose
}, (b) => {
  b.box(0, 0, 0, 5, 3, 4, 1); // body
  b.box(1, 0, 3, 3, 2, 1, 2); // belly
  b.boxM(0, 0, 4, 1, 1, 1, 2); // feet
  b.box(0, 3, 0, 5, 2, 4, 1); // head
  b.boxM(0, 5, 1, 2, 1, 2, 1); // ears
  b.boxM(1, 5, 2, 1, 1, 1, 2); // inner ears
  b.box(2, 3, 4, 1, 2, 1, 3); // nose
  b.setM(1, 4, 3, 3); // eyes
});

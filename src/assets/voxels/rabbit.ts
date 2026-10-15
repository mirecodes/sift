import { defineModel } from './builder';

// Rabbit: white body, grey haunches, tall ears with pink insides.
export const rabbit = defineModel([5, 5, 5], {
  1: ['body', '#F4F4F4'], // fur
  2: ['nose', '#F4A6B7'], // inner ears, nose
  3: ['eye', '#1E1E1E'], // eye
  4: ['body2', '#D5D8DE'], // haunches
}, (b) => {
  b.box(1, 0, 0, 3, 3, 4, 1); // body
  b.boxM(0, 0, 0, 1, 2, 3, 4); // haunches
  b.box(1, 1, 3, 3, 2, 2, 1); // head
  b.boxM(1, 3, 2, 1, 2, 2, 1); // ears
  b.boxM(1, 3, 3, 1, 2, 1, 2); // inner ears
  b.set(2, 1, 4, 2); // nose
  b.setM(1, 2, 4, 3); // eyes
});

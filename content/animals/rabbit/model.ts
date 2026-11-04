import { defineModel } from '../../../tools/content-build/animal';

// Rabbit: crouching white body, grey haunches, a round head with tall upright ears and a pink nose,
// a cotton tail.
export default defineModel([5, 5, 6], {
  1: ['body', '#F4F4F4'], // fur
  2: ['nose', '#F4A6B7'], // nose, inner ears
  3: ['eye', '#1E1E1E'], // eyes
  4: ['body2', '#D5D8DE'], // haunches
}, (b) => {
  b.box(1, 0, 1, 3, 2, 3, 1); // body
  b.pair('legB', [0.5, 1, 2], () => b.box(0, 0, 1, 1, 2, 2, 4)); // haunches
  b.pair('legF', [1, 0.5, 4], () => b.box(1, 0, 4, 1, 1, 1, 1));
  b.part('tail', [2, 1, 0.5], () => b.set(2, 1, 0, 1));
  b.part('head', [2, 1.5, 3.5], () => {
    b.box(1, 1, 3, 3, 2, 3, 1);
    b.setM(1, 2, 5, 3); // eyes
    b.set(2, 1, 5, 2); // nose
  });
  b.pair('ear', [1, 2.5, 3.5], () => {
    b.box(1, 3, 3, 1, 2, 1, 1);
    b.set(1, 3, 4, 2); // pink inside
  });
});

import { defineModel } from '../../../tools/content-build/animal';

// Mouse: small grey body, big round pink ears, a pointed face and a thin pink tail curling up.
export default defineModel([5, 4, 8], {
  1: ['body', '#B8BCC4'], // fur
  2: ['nose', '#F4A6B7'], // ears, nose, tail
  3: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.pair('legF', [1, 0.5, 5], () => b.box(1, 0, 5, 1, 1, 1, 2));
  b.pair('legB', [1, 0.5, 2], () => b.box(1, 0, 2, 1, 1, 1, 2));
  b.box(1, 1, 2, 3, 2, 4, 1); // body
  b.part('tail', [2, 1.5, 1.5], () => {
    b.box(2, 1, 0, 1, 1, 2, 2);
    b.set(2, 2, 0, 2);
  });
  b.part('head', [2, 2, 5.5], () => {
    b.box(1, 1, 6, 3, 2, 1, 1);
    b.set(2, 1, 7, 2); // nose
    b.setM(1, 2, 6, 3); // eyes
  });
  b.pair('ear', [1, 2.5, 5.5], () => b.box(0, 3, 5, 2, 1, 1, 2));
});

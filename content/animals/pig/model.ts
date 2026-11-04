import { defineModel } from '../../../tools/content-build/animal';

// Pig: round pink body on short legs, a big flat snout with nostrils, floppy ears and a curly tail.
export default defineModel([5, 5, 8], {
  1: ['body', '#F4A6B7'], // skin
  2: ['nose', '#E58AA0'], // snout, ears
  3: ['eye', '#1E1E1E'], // eyes, nostrils
}, (b) => {
  b.pair('legF', [1, 0.5, 5], () => b.box(1, 0, 5, 1, 1, 1, 1));
  b.pair('legB', [1, 0.5, 1], () => b.box(1, 0, 1, 1, 1, 1, 1));
  b.box(0, 1, 1, 5, 3, 5, 1); // body
  b.erase(0, 3, 1, 1, 1, 5);
  b.erase(4, 3, 1, 1, 1, 5);
  b.part('tail', [2, 3, 0.5], () => {
    b.set(2, 3, 0, 1);
    b.set(2, 4, 0, 2); // curl
  });
  b.part('head', [2, 2.5, 5.5], () => {
    b.box(1, 2, 6, 3, 3, 1, 1);
    b.box(1, 2, 7, 3, 2, 1, 2); // snout
    b.setM(1, 2, 7, 3); // nostrils
    b.setM(1, 4, 6, 3); // eyes
    b.setM(0, 4, 5, 2); // ears
  });
});

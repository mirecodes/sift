import { defineModel } from '../../../tools/content-build/animal';

// Mole: round dark grey body, big tan digging paws at the front, tiny eyes and a pink nose.
export default defineModel([5, 3, 7], {
  1: ['body', '#5A5F6B'], // fur
  2: ['nose', '#F4A6B7'], // nose
  3: ['eye', '#1E1E1E'], // eyes
  4: ['accent', '#E8B58A'], // paws
}, (b) => {
  b.box(0, 0, 0, 5, 3, 5, 1); // body
  b.erase(0, 2, 0, 1, 1, 5); // rounded top
  b.erase(4, 2, 0, 1, 1, 5);
  b.erase(1, 2, 0, 3, 1, 1);
  b.pair('legF', [0.5, 1, 4], () => b.box(0, 0, 4, 1, 1, 2, 4));
  b.pair('legB', [1, 0.5, 1], () => b.box(1, 0, 0, 1, 1, 1, 4));
  b.part('head', [2, 1, 4.5], () => {
    b.box(1, 0, 5, 3, 2, 1, 1);
    b.set(2, 0, 6, 2); // nose
    b.setM(1, 1, 5, 3); // eyes
  });
});

import { defineModel } from '../../../tools/content-build/animal';

// Sparrow: round brown body, cream chest and cheeks, a short perky tail and a little beak.
export default defineModel([5, 5, 6], {
  1: ['body', '#9C6B3F'], // plumage
  2: ['belly', '#F5E6C8'], // chest, cheeks
  3: ['eye', '#1E1E1E'], // eyes
  4: ['beak', '#F2A93B'], // beak, feet
  5: ['wing', '#6E4526'], // wings, tail
}, (b) => {
  b.pair('leg', [1, 0.5, 2], () => b.box(1, 0, 2, 1, 1, 1, 4));
  b.box(1, 1, 1, 3, 2, 3, 1); // body
  b.box(1, 1, 4, 3, 2, 1, 2); // chest
  b.pair('wing', [0.5, 2.5, 2], () => b.box(0, 1, 1, 1, 2, 3, 5));
  b.part('tail', [2, 2, 0.5], () => {
    b.box(2, 2, 0, 1, 1, 1, 5);
    b.set(2, 3, 0, 5);
  });
  b.part('head', [2, 2.5, 3], () => {
    b.box(1, 3, 2, 3, 2, 3, 1);
    b.setM(1, 3, 4, 2); // cheeks
    b.setM(1, 4, 4, 3); // eyes
    b.set(2, 3, 5, 4); // beak
  });
});

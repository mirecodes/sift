import { defineModel } from '../../../tools/content-build/animal';

// Sparrow: round brown body, cream chest and cheeks, short tail.
export default defineModel([4, 5, 5], {
  1: ['body', '#9C6B3F'], // plumage
  2: ['belly', '#F5E6C8'], // chest, cheeks
  3: ['eye', '#1E1E1E'], // eye
  4: ['beak', '#F2A93B'], // beak, feet
  5: ['wing', '#6E4526'], // wings, tail
}, (b) => {
  b.boxM(1, 0, 2, 1, 1, 1, 4); // feet
  b.box(0, 1, 1, 4, 2, 3, 1); // body
  b.box(1, 2, 0, 2, 1, 1, 5); // tail
  b.boxM(0, 2, 1, 1, 1, 2, 5); // wings
  b.box(1, 1, 3, 2, 2, 1, 2); // chest
  b.box(0, 3, 2, 4, 2, 2, 1); // head
  b.box(1, 3, 3, 2, 1, 1, 2); // cheeks
  b.box(1, 3, 4, 2, 1, 1, 4); // beak
  b.setM(0, 4, 3, 3); // eyes
});

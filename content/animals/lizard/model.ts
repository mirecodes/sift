import { defineModel } from '../../../tools/content-build/animal';

// Lizard: flat green body, long thin tail and a light stripe down the back.
export default defineModel([3, 3, 6], {
  1: ['body', '#8ED15B'], // skin
  2: ['accent', '#C8EE8E'], // back stripe
  3: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.boxM(0, 0, 1, 1, 1, 1, 1); // legs
  b.boxM(0, 0, 3, 1, 1, 1, 1);
  b.box(0, 1, 0, 3, 1, 5, 1); // body
  b.erase(0, 1, 0, 1, 1, 2); // taper the tail
  b.erase(2, 1, 0, 1, 1, 2);
  b.box(1, 2, 1, 1, 1, 3, 2); // stripe
  b.box(0, 1, 4, 3, 2, 2, 1); // head
  b.setM(0, 2, 5, 3); // eyes
});

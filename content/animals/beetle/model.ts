import { defineModel } from '../../../tools/content-build/animal';

// Beetle: glossy dark brown shell with one horn on the head.
export default defineModel([4, 4, 6], {
  1: ['body', '#5B3A22'], // shell
  2: ['accent', '#8A5A36'], // shine, horn
  3: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.boxM(0, 0, 1, 1, 1, 1, 1); // legs
  b.boxM(0, 0, 3, 1, 1, 1, 1);
  b.box(0, 1, 0, 4, 2, 4, 1); // body
  b.box(1, 3, 1, 2, 1, 2, 2); // shine
  b.box(0, 1, 4, 4, 2, 1, 1); // head
  b.setM(0, 2, 4, 3); // eyes
  b.box(1, 3, 4, 2, 1, 2, 2); // horn
});

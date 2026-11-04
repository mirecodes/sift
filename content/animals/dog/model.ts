import { defineModel } from '../../../tools/content-build/animal';

// Dog (puppy): light brown, a big round head with a stepped muzzle, floppy dark ears, an upright tail.
export default defineModel([7, 7, 8], {
  1: ['body', '#C9955C'], // fur
  2: ['muzzle', '#E6C39A'], // muzzle, chest
  3: ['accent', '#7A5230'], // ears
  4: ['eye', '#1E1E1E'], // eyes
  5: ['nose', '#2B2B2B'], // nose
}, (b) => {
  b.pair('legF', [2, 1.5, 5], () => b.box(2, 0, 5, 1, 2, 1, 1));
  b.pair('legB', [2, 1.5, 1], () => b.box(2, 0, 1, 1, 2, 1, 1));
  b.box(2, 2, 1, 3, 2, 5, 1); // body
  b.box(3, 2, 5, 1, 2, 1, 2); // chest
  b.part('tail', [3, 3.5, 0.5], () => {
    b.box(3, 4, 0, 1, 2, 1, 1);
    b.set(3, 5, 0, 2); // light tip
  });
  b.part('head', [3, 3.5, 4.5], () => {
    b.box(1, 3, 4, 5, 3, 3, 1); // round head, 3 deep
    b.box(2, 3, 7, 3, 2, 1, 2); // stepped muzzle
    b.set(3, 4, 7, 5); // nose on the muzzle
    b.setM(2, 5, 6, 4); // eyes
    b.box(3, 6, 5, 1, 1, 1, 1); // crown
  });
  b.pair('ear', [1, 5.5, 5.5], () => {
    b.set(1, 6, 5, 3);
    b.box(0, 3, 5, 1, 3, 2, 3); // floppy, hanging along the head
  });
});

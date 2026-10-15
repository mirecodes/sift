import { defineModel } from './builder';

// Pig: pink body, darker snout, small ears and curly tail.
export const pig = defineModel([5, 5, 6], {
  1: ['body', '#F4A6B7'], // skin
  2: ['nose', '#E58AA0'], // snout, tail
  3: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.boxM(0, 0, 0, 2, 1, 1, 1); // hind legs
  b.boxM(0, 0, 3, 2, 1, 1, 1); // front legs
  b.box(0, 1, 0, 5, 2, 4, 1); // body
  b.box(1, 3, 0, 3, 1, 4, 1); // body top
  b.box(1, 1, 4, 3, 3, 2, 1); // head
  b.box(1, 1, 5, 3, 2, 1, 2); // snout
  b.boxM(1, 4, 4, 1, 1, 1, 1); // ears
  b.setM(1, 3, 5, 3); // eyes
  b.set(2, 3, 0, 2); // tail
  b.set(2, 4, 0, 2);
});

import { defineModel } from './builder';

// Squirrel: orange-brown body with a big bushy tail curling up behind.
export const squirrel = defineModel([3, 5, 6], {
  1: ['body', '#C8743A'], // fur
  2: ['muzzle', '#F3DDBB'], // muzzle
  3: ['eye', '#1E1E1E'], // eye
  4: ['accent', '#E8A56B'], // tail tip
}, (b) => {
  b.box(0, 0, 2, 3, 2, 3, 1); // body
  b.box(0, 1, 4, 3, 3, 2, 1); // head
  b.setM(0, 4, 4, 1); // ears
  b.box(1, 1, 5, 1, 2, 1, 2); // muzzle
  b.setM(0, 3, 5, 3); // eyes
  b.box(0, 1, 0, 3, 3, 2, 1); // tail
  b.box(1, 0, 0, 1, 1, 2, 1); // tail base
  b.box(0, 3, 0, 3, 1, 2, 4); // tail tip
  b.box(1, 4, 0, 1, 1, 2, 4); // tail tip top
});

import { defineModel } from '../../../tools/content-build/animal';

// Red panda: rust fur, white face, dark legs and a tall ringed tail.
export default defineModel([4, 8, 6], {
  1: ['body', '#C4542D'], // fur
  2: ['muzzle', '#FFFFFF'], // face
  3: ['eye', '#1E1E1E'], // eye, nose
  4: ['accent', '#4A2A1F'], // legs, tail rings
  5: ['accent2', '#E8B27A'], // tail rings
}, (b) => {
  b.box(1, 2, 0, 2, 1, 1, 5); // tail rings, bottom to top
  b.box(1, 3, 0, 2, 1, 1, 4);
  b.box(1, 4, 0, 2, 1, 1, 5);
  b.box(1, 5, 0, 2, 1, 1, 4);
  b.box(0, 2, 1, 4, 3, 4, 1); // body
  b.boxM(0, 0, 1, 1, 2, 1, 4); // hind legs
  b.boxM(0, 0, 4, 1, 2, 1, 4); // front legs
  b.box(0, 5, 3, 4, 2, 3, 1); // head
  b.box(0, 5, 5, 4, 2, 1, 2); // face
  b.box(1, 5, 5, 2, 1, 1, 3); // nose
  b.setM(0, 6, 5, 3); // eyes
  b.boxM(0, 7, 3, 1, 1, 1, 1); // ears
});

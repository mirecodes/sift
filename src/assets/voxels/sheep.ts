import { defineModel } from './builder';

// Sheep: fluffy white wool body, dark face and legs.
export const sheep = defineModel([5, 6, 6], {
  1: ['body', '#F4F4F0'], // wool
  2: ['accent', '#3A3A3A'], // face, legs, ears
  3: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.boxM(1, 0, 0, 1, 2, 1, 2); // hind legs
  b.boxM(1, 0, 3, 1, 2, 1, 2); // front legs
  b.box(0, 2, 0, 5, 2, 4, 1); // wool
  b.box(1, 4, 0, 3, 1, 4, 1); // wool top
  b.box(1, 3, 4, 3, 2, 2, 2); // head
  b.box(1, 5, 3, 3, 1, 2, 1); // top knot
  b.boxM(0, 4, 4, 1, 1, 1, 2); // ears
  b.setM(1, 4, 5, 3); // eyes
});

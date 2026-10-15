import { defineModel } from './builder';

// Ladybug: round red back with black spots, black head with white eyes.
export const ladybug = defineModel([5, 3, 5], {
  1: ['body', '#E63946'], // shell
  2: ['eye', '#1E1E1E'], // head, spots
  3: ['accent', '#FFFFFF'], // eye
}, (b) => {
  b.box(0, 0, 0, 5, 1, 4, 1); // base
  b.box(1, 1, 0, 3, 2, 4, 1); // dome
  b.box(1, 0, 4, 3, 2, 1, 2); // head
  b.setM(1, 1, 4, 3); // eyes
  b.setM(1, 2, 1, 2); // spots
  b.set(2, 2, 3, 2);
  b.setM(0, 0, 2, 2);
});

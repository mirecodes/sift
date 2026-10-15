import { defineModel } from './builder';

// Pigeon: blue-grey plumage, dark wings, green-purple gloss band on the neck.
export const pigeon = defineModel([5, 5, 6], {
  1: ['body', '#8F9BB3'], // plumage
  2: ['wing', '#6A7590'], // wings
  3: ['eye', '#1E1E1E'], // eye
  4: ['accent', '#58B88A'], // neck gloss
  5: ['beak', '#F2A93B'], // beak, feet
}, (b) => {
  b.boxM(1, 0, 2, 1, 1, 1, 5); // feet
  b.box(0, 1, 0, 5, 2, 5, 1); // body
  b.box(0, 2, 0, 5, 1, 3, 2); // wings
  b.box(1, 1, 4, 3, 2, 1, 4); // chest gloss
  b.box(1, 3, 3, 3, 2, 2, 1); // head
  b.box(1, 3, 3, 3, 1, 2, 4); // neck gloss
  b.set(2, 3, 5, 5); // beak
  b.setM(1, 4, 4, 3); // eyes
});

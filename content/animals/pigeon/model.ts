import { defineModel } from '../../../tools/content-build/animal';

// Pigeon: blue-grey plumage, a puffed chest, dark wings and tail, green gloss band on the neck.
export default defineModel([5, 5, 7], {
  1: ['body', '#8F9BB3'], // plumage
  2: ['wing', '#6A7590'], // wings, tail
  3: ['eye', '#1E1E1E'], // eyes
  4: ['accent', '#58B88A'], // neck gloss
  5: ['beak', '#F2A93B'], // beak, feet
}, (b) => {
  b.pair('leg', [1, 0.5, 3], () => b.box(1, 0, 3, 1, 1, 1, 5));
  b.box(1, 1, 1, 3, 2, 5, 1); // body and chest
  b.pair('wing', [0.5, 2.5, 2.5], () => b.box(0, 1, 1, 1, 2, 3, 2));
  b.part('tail', [2, 2, 0.5], () => b.box(1, 2, 0, 3, 1, 1, 2));
  b.part('head', [2, 2.5, 4.5], () => {
    b.box(1, 3, 4, 3, 1, 2, 4); // gloss band
    b.box(1, 4, 4, 3, 1, 2, 1);
    b.setM(1, 4, 5, 3); // eyes
    b.set(2, 4, 6, 5); // beak
  });
});

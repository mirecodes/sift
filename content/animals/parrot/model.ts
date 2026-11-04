import { defineModel } from '../../../tools/content-build/animal';

// Parrot: red body standing tall, blue wings with a yellow stripe, a long blue tail, a pale hooked beak
// and a little crest.
export default defineModel([5, 7, 6], {
  1: ['body', '#E8403F'], // plumage
  2: ['wing', '#3B89FF'], // wings, tail
  3: ['eye', '#1E1E1E'], // eyes
  4: ['accent', '#FFC933'], // wing stripe
  5: ['beak', '#F7F0DC'], // beak, feet
}, (b) => {
  b.pair('leg', [1, 0.5, 2], () => b.box(1, 0, 2, 1, 1, 1, 5));
  b.box(1, 1, 1, 3, 3, 3, 1); // body
  b.pair('wing', [0.5, 3.5, 2], () => {
    b.box(0, 1, 1, 1, 3, 2, 2);
    b.set(0, 3, 2, 4); // stripe
  });
  b.part('tail', [2, 1.5, 0.5], () => b.box(2, 0, 0, 1, 3, 1, 2));
  b.part('head', [2, 3.5, 2], () => {
    b.box(1, 4, 1, 3, 2, 3, 1);
    b.box(2, 4, 4, 1, 2, 1, 5); // hooked beak
    b.setM(1, 5, 3, 3); // eyes
    b.set(2, 6, 2, 1); // crest
  });
});

import { defineModel } from '../../../tools/content-build/animal';

// Parrot: red body, blue wings and tail, a yellow wing stripe and a pale hooked beak.
export default defineModel([4, 7, 5], {
  1: ['body', '#E8403F'], // body
  2: ['wing', '#3B89FF'], // wings, tail
  3: ['eye', '#1E1E1E'], // eye
  4: ['accent', '#FFC933'], // wing stripe
  5: ['beak', '#F7F0DC'], // beak, feet
}, (b) => {
  b.boxM(1, 0, 2, 1, 1, 1, 5); // feet
  b.box(0, 1, 1, 4, 3, 3, 1); // body
  b.box(1, 0, 0, 2, 4, 1, 2); // tail
  b.boxM(0, 1, 1, 1, 3, 2, 2); // wings
  b.boxM(0, 2, 1, 1, 1, 2, 4); // stripe
  b.box(0, 4, 1, 4, 3, 3, 1); // head
  b.box(1, 4, 4, 2, 2, 1, 5); // beak
  b.setM(0, 5, 3, 3); // eyes
});

import { defineModel } from '../../../tools/content-build/animal';

// Duck (mallard): long grey body, brown chest, white neck ring, glossy green head, a wide flat yellow
// bill and a curled tail. Kept clearly apart from the Chick (round yellow ball).
export default defineModel([5, 5, 8], {
  1: ['body', '#A3A8AD'], // grey body, wings
  2: ['body2', '#7A4E2D'], // chest
  3: ['accent', '#2E7D4F'], // head, tail curl
  4: ['accent2', '#FFFFFF'], // neck ring, tail
  5: ['beak', '#F2C230'], // bill, feet
  6: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.pair('leg', [1, 0.5, 3], () => b.box(1, 0, 3, 1, 1, 2, 5));
  b.box(1, 1, 1, 3, 2, 5, 1); // body
  b.box(1, 1, 5, 3, 2, 2, 2); // chest
  b.box(1, 2, 6, 3, 1, 1, 4); // neck ring
  b.pair('wing', [0.5, 2.5, 3], () => {
    b.box(0, 1, 2, 1, 2, 3, 1);
    b.set(0, 2, 4, 3); // speculum
  });
  b.part('tail', [2, 2, 0.5], () => {
    b.box(1, 2, 0, 3, 1, 1, 4);
    b.set(2, 3, 0, 3); // curl
  });
  b.part('head', [2, 2.5, 6], () => {
    b.box(1, 3, 5, 3, 2, 2, 3); // green head
    b.box(1, 3, 7, 3, 1, 1, 5); // wide flat bill
    b.setM(1, 4, 6, 6); // eyes
  });
});

import { defineModel } from './builder';

// Hen: white body with a red comb and wattle, the grown-up chick.
export const hen = defineModel([5, 5, 5], {
  1: ['body', '#F7F7F7'], // feathers
  2: ['accent', '#E23B3B'], // comb, wattle
  3: ['eye', '#1E1E1E'], // eye
  4: ['beak', '#F2A93B'], // beak, feet
  5: ['wing', '#DCDCDC'], // wings
}, (b) => {
  b.boxM(1, 0, 1, 1, 1, 1, 4); // feet
  b.box(0, 1, 0, 5, 2, 4, 1); // body
  b.box(2, 3, 0, 1, 1, 1, 1); // tail
  b.boxM(0, 1, 1, 1, 2, 2, 5); // wings
  b.box(1, 3, 2, 3, 2, 2, 1); // head
  b.box(2, 4, 2, 1, 1, 2, 2); // comb
  b.set(2, 3, 4, 4); // beak
  b.set(2, 2, 3, 2); // wattle
  b.setM(1, 3, 3, 3); // eyes
});

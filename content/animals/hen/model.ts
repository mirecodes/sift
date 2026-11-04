import { defineModel } from '../../../tools/content-build/animal';

// Hen: plump white body, raised tail feathers, a red comb and wattle, orange beak and feet.
export default defineModel([5, 5, 6], {
  1: ['body', '#F7F7F7'], // feathers
  2: ['accent', '#E23B3B'], // comb, wattle
  3: ['eye', '#1E1E1E'], // eyes
  4: ['beak', '#F2A93B'], // beak, feet
  5: ['wing', '#DCDCDC'], // wings
}, (b) => {
  b.pair('leg', [1, 0.5, 2], () => b.box(1, 0, 2, 1, 1, 1, 4));
  b.box(1, 1, 1, 3, 2, 3, 1); // body
  b.box(1, 3, 1, 3, 1, 2, 1); // back
  b.pair('wing', [0.5, 2.5, 2], () => b.box(0, 1, 1, 1, 2, 3, 5));
  b.part('tail', [2, 2.5, 0.5], () => {
    b.box(1, 2, 0, 3, 2, 1, 1);
    b.set(2, 4, 0, 1);
  });
  b.part('head', [2, 3, 3.5], () => {
    b.box(1, 3, 3, 3, 2, 2, 1);
    b.box(2, 4, 3, 1, 1, 2, 2); // comb
    b.setM(1, 4, 4, 3); // eyes
    b.set(2, 3, 5, 4); // beak
    b.set(2, 2, 4, 2); // wattle
  });
});

import { defineModel } from '../../../tools/content-build/animal';

// Goat: off-white body on slim legs, swept-back horns, ears out to the sides and a chin beard.
export default defineModel([5, 7, 8], {
  1: ['body', '#F0EBE0'], // coat
  2: ['horn', '#B8A98A'], // horns
  3: ['accent', '#CFC7B2'], // hooves, beard
  4: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  const leg = (z: number) => {
    b.box(1, 0, z, 1, 3, 1, 1);
    b.set(1, 0, z, 3);
  };
  b.pair('legF', [1, 2.5, 5], () => leg(5));
  b.pair('legB', [1, 2.5, 1], () => leg(1));
  b.box(1, 3, 1, 3, 2, 5, 1); // body
  b.part('tail', [2, 4.5, 0.5], () => b.set(2, 5, 0, 1));
  b.part('head', [2, 4.5, 5], () => {
    b.box(1, 5, 5, 3, 2, 2, 1);
    b.box(1, 5, 7, 3, 1, 1, 1); // snout
    b.set(2, 4, 7, 3); // beard
    b.setM(1, 6, 6, 4); // eyes
    b.setM(1, 6, 4, 2); // horns, swept back
    b.setM(1, 6, 5, 2);
    b.setM(0, 5, 5, 1); // ears
  });
});

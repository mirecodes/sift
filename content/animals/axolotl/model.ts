import { defineModel } from '../../../tools/content-build/animal';

// Axolotl: pink body on sprawled legs, a tail with a fin, a round smiling head with two eyes far apart
// and feathery gills that ripple on both sides.
export default defineModel([6, 5, 8], {
  1: ['body', '#F5B5C8'], // body
  2: ['accent', '#EE7EA8'], // gills, fin
  3: ['eye', '#1E1E1E'], // eyes
  4: ['muzzle', '#FFE1EA'], // belly, smile
}, (b) => {
  b.box(1, 1, 2, 4, 2, 3, 1); // body
  b.box(2, 1, 3, 2, 1, 2, 4); // belly
  b.pair('legF', [1, 0.5, 4], () => b.box(0, 0, 4, 2, 1, 1, 1));
  b.pair('legB', [1, 0.5, 2], () => b.box(0, 0, 2, 2, 1, 1, 1));
  b.part('tail', [2.5, 1.5, 1.5], () => {
    b.box(2, 1, 0, 2, 2, 2, 1);
    b.box(2, 3, 0, 2, 1, 2, 2); // fin
  });
  b.part('head', [2.5, 2, 4.5], () => {
    b.box(1, 1, 5, 4, 3, 3, 1); // round head
    b.box(2, 1, 7, 2, 1, 1, 4); // smile
    b.setM(1, 3, 7, 3); // eyes
  });
  b.pair('ear', [0.5, 3, 5.5], () => {
    b.box(0, 2, 5, 1, 3, 1, 2); // gills
    b.set(0, 4, 6, 2);
  });
});

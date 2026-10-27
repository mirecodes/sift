import { defineModel } from '../../../tools/content-build/animal';

// Axolotl: pink body with feathery gills on both sides of a wide smiling head.
export default defineModel([6, 5, 6], {
  1: ['body', '#F5B5C8'], // skin
  2: ['accent', '#EE7EA8'], // gills, tail fin
  3: ['eye', '#1E1E1E'], // eye
  4: ['muzzle', '#FFE1EA'], // mouth
}, (b) => {
  b.box(1, 0, 0, 4, 2, 4, 1); // body
  b.box(2, 2, 0, 2, 1, 1, 2); // tail fin
  b.box(1, 1, 3, 4, 3, 3, 1); // head
  b.boxM(0, 2, 3, 1, 3, 1, 2); // gills
  b.boxM(0, 3, 4, 1, 2, 1, 2);
  b.box(2, 1, 5, 2, 1, 1, 4); // mouth
  b.setM(1, 2, 5, 3); // eyes
});

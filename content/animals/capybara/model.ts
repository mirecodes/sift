import { defineModel } from '../../../tools/content-build/animal';

// Capybara: boxy tan body with a mikan orange balanced on its head.
export default defineModel([5, 7, 6], {
  1: ['body', '#B58B5A'], // fur
  2: ['muzzle', '#8A6440'], // muzzle, ears
  3: ['eye', '#1E1E1E'], // eye
  4: ['prop', '#FF9F1C'], // orange
  5: ['prop2', '#5FA83E'], // leaf
}, (b) => {
  b.boxM(0, 0, 0, 1, 1, 2, 2); // feet
  b.boxM(0, 0, 3, 1, 1, 2, 2);
  b.box(0, 1, 0, 5, 3, 5, 1); // body
  b.box(1, 3, 4, 3, 2, 2, 1); // head
  b.box(1, 3, 5, 3, 1, 1, 2); // muzzle
  b.setM(1, 4, 5, 3); // eyes
  b.boxM(1, 5, 4, 1, 1, 1, 2); // ears
  b.set(2, 5, 4, 4); // orange
  b.set(2, 6, 4, 5); // leaf
});

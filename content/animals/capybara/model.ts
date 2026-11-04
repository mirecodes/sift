import { defineModel } from '../../../tools/content-build/animal';

// Capybara: calm boxy tan body, a long blunt snout and a mikan orange balanced on its head.
export default defineModel([5, 7, 8], {
  1: ['body', '#B58B5A'], // fur
  2: ['muzzle', '#8A6440'], // snout, ears
  3: ['eye', '#1E1E1E'], // eyes
  4: ['prop', '#FF9F1C'], // mikan
  5: ['prop2', '#5FA83E'], // leaf
}, (b) => {
  b.pair('legF', [1, 1.5, 5], () => b.box(1, 0, 5, 1, 2, 1, 1));
  b.pair('legB', [1, 1.5, 1], () => b.box(1, 0, 1, 1, 2, 1, 1));
  b.box(0, 2, 1, 5, 3, 5, 1); // body
  b.erase(0, 4, 1, 1, 1, 5);
  b.erase(4, 4, 1, 1, 1, 5);
  b.part('head', [2, 3.5, 5], () => {
    b.box(1, 3, 5, 3, 3, 2, 1);
    b.box(1, 3, 7, 3, 2, 1, 2); // blunt snout
    b.setM(1, 5, 6, 3); // eyes
    b.setM(1, 6, 5, 2); // ears
    b.set(2, 6, 5, 4); // mikan
    b.set(2, 6, 6, 5); // leaf
  });
});

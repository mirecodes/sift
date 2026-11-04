import { defineModel } from '../../../tools/content-build/animal';

// Goat: off-white body, swept-back horns and a chin beard.
export default defineModel([3, 7, 6], {
  1: ['body', '#F0EBE0'], // fur
  2: ['horn', '#B8A98A'], // horns
  3: ['accent', '#CFC7B2'], // beard
  4: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.boxM(0, 0, 0, 1, 2, 1, 1); // hind legs
  b.boxM(0, 0, 3, 1, 2, 1, 1); // front legs
  b.box(0, 2, 0, 3, 2, 4, 1); // body
  b.set(1, 4, 0, 1); // tail
  b.box(0, 3, 4, 3, 3, 2, 1); // head
  b.boxM(0, 6, 3, 1, 1, 2, 2); // horns
  b.box(1, 1, 5, 1, 2, 1, 3); // beard
  b.setM(0, 5, 5, 4); // eyes
});

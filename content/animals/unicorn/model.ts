import { defineModel } from '../../../tools/content-build/animal';

// Unicorn: white body, gold horn, rainbow mane and tail.
export default defineModel([3, 11, 6], {
  1: ['body', '#FFFFFF'], // coat
  2: ['horn', '#FFD24D'], // horn
  3: ['eye', '#1E1E1E'], // eye
  4: ['rainbow1', '#FF5A5F'], // rainbow red
  5: ['rainbow2', '#FFA24D'], // rainbow orange
  6: ['rainbow3', '#FFE14D'], // rainbow yellow
  7: ['rainbow4', '#5ED67A'], // rainbow green
  8: ['rainbow5', '#4DA6FF'], // rainbow blue
}, (b) => {
  b.boxM(0, 0, 1, 1, 4, 1, 1); // hind legs
  b.boxM(0, 0, 4, 1, 4, 1, 1); // front legs
  b.box(0, 4, 1, 3, 3, 4, 1); // body
  b.box(0, 7, 4, 3, 2, 2, 1); // head
  b.box(0, 6, 4, 3, 1, 2, 1); // neck
  b.box(1, 9, 5, 1, 2, 1, 2); // horn
  b.boxM(0, 9, 4, 1, 1, 1, 1); // ears
  b.setM(0, 8, 5, 3); // eyes
  // Mane, back of the head down the spine.
  b.box(0, 9, 3, 3, 1, 1, 4);
  b.box(0, 8, 3, 3, 1, 1, 5);
  b.box(0, 7, 3, 3, 1, 1, 6);
  b.box(0, 7, 2, 3, 1, 1, 7);
  b.box(0, 7, 1, 3, 1, 1, 8);
  // Tail, red at the top to blue at the tip.
  b.box(0, 6, 0, 3, 1, 1, 4);
  b.box(0, 5, 0, 3, 1, 1, 5);
  b.box(0, 4, 0, 3, 1, 1, 6);
  b.box(0, 3, 0, 3, 1, 1, 7);
  b.box(0, 2, 0, 3, 1, 1, 8);
});

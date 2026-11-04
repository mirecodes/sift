import { defineModel } from '../../../tools/content-build/animal';

// Peacock: teal body, small gold crest and a big green tail fan with gold eye spots.
export default defineModel([5, 10, 6], {
  1: ['body', '#1FA8A0'], // body
  2: ['accent', '#2B6FD0'], // chest, spot centers
  3: ['eye', '#1E1E1E'], // eye
  4: ['accent2', '#FFC933'], // crest, eye spots
  5: ['accent3', '#5FBF78'], // tail fan
  6: ['beak', '#F2A93B'], // beak
}, (b) => {
  b.box(1, 2, 0, 3, 1, 1, 5); // tail fan
  b.box(0, 3, 0, 5, 4, 1, 5);
  b.box(1, 7, 0, 3, 1, 1, 5);
  b.box(2, 8, 0, 1, 1, 1, 5);
  b.setM(1, 4, 0, 4); // eye spots
  b.set(2, 6, 0, 4);
  b.set(2, 5, 0, 2);
  b.boxM(1, 0, 3, 1, 2, 1, 6); // legs
  b.box(1, 2, 1, 3, 3, 4, 1); // body
  b.box(1, 2, 4, 3, 3, 1, 2); // chest
  b.box(2, 5, 4, 1, 2, 1, 2); // neck
  b.box(1, 7, 3, 3, 2, 2, 2); // head
  b.set(2, 7, 5, 6); // beak
  b.setM(1, 8, 4, 3); // eyes
  b.set(2, 9, 4, 4); // crest
});

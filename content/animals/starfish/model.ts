import { defineModel } from '../../../tools/content-build/animal';

// Starfish: flat coral star with five short arms and a sleepy face on top.
export default defineModel([5, 3, 5], {
  1: ['body', '#FF7F6E'], // body
  2: ['accent', '#FFB0A0'], // center bump
  3: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.box(1, 0, 1, 3, 2, 3, 1); // center
  b.box(2, 0, 4, 1, 2, 1, 1); // top arm
  b.boxM(0, 0, 3, 1, 2, 1, 1); // side arms
  b.boxM(1, 0, 0, 1, 2, 1, 1); // bottom arms
  b.box(2, 2, 1, 1, 1, 3, 2); // bump
  b.setM(1, 1, 3, 3); // eyes
});

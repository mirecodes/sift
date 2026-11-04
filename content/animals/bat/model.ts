import { defineModel } from '../../../tools/content-build/animal';

// Bat: purple-black body, spread wings, pointed ears and two small fangs.
export default defineModel([6, 5, 3], {
  1: ['body', '#4A3A6B'], // body
  2: ['wing', '#7A5FA8'], // wings
  3: ['eye', '#1E1E1E'], // eye
  4: ['accent', '#FFFFFF'], // fangs
}, (b) => {
  b.boxM(0, 2, 1, 2, 2, 2, 2); // wings
  b.boxM(0, 1, 0, 2, 1, 2, 2); // wing tips
  b.box(2, 1, 0, 2, 3, 3, 1); // body
  b.box(1, 3, 1, 4, 1, 2, 1); // head
  b.boxM(1, 4, 1, 1, 1, 1, 1); // ears
  b.setM(1, 3, 2, 3); // eyes
  b.setM(2, 2, 2, 4); // fangs
});

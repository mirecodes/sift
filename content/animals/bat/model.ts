import { defineModel } from '../../../tools/content-build/animal';

// Bat: small purple-black body, pointed ears, two fangs and wide scalloped wings held out to the sides.
export default defineModel([8, 5, 3], {
  1: ['body', '#4A3A6B'], // body
  2: ['wing', '#7A5FA8'], // wings
  3: ['eye', '#1E1E1E'], // eyes
  4: ['accent', '#FFFFFF'], // fangs
}, (b) => {
  b.box(3, 0, 1, 2, 2, 2, 1); // body
  b.pair('wing', [2.5, 2.5, 1], () => {
    b.box(0, 1, 1, 3, 3, 1, 2); // membrane
    b.erase(1, 1, 1, 1, 1, 1); // scalloped edge
    b.box(0, 3, 1, 3, 1, 1, 1); // arm bone along the top
  });
  b.part('head', [3.5, 1.5, 1.5], () => {
    b.box(3, 2, 1, 2, 2, 2, 1);
    b.setM(3, 3, 2, 3); // eyes
    b.setM(3, 2, 2, 4); // fangs
    b.setM(3, 4, 1, 1); // ears
  });
});

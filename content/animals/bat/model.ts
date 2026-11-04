import { defineModel } from '../../../tools/content-build/animal';

// Bat: small purple-black body, a round head with two eyes apart, pointed ears, two tiny fangs and
// small scalloped wings held out to the sides.
export default defineModel([7, 5, 3], {
  1: ['body', '#4A3A6B'], // body
  2: ['wing', '#7A5FA8'], // wings
  3: ['eye', '#1E1E1E'], // eyes
  4: ['accent', '#FFFFFF'], // fangs
}, (b) => {
  b.box(2, 0, 1, 3, 2, 2, 1); // body
  b.pair('wing', [1.5, 2.5, 1], () => {
    b.box(0, 1, 1, 2, 3, 1, 2); // membrane
    b.erase(0, 1, 1, 1, 1, 1); // scalloped edge
    b.box(0, 3, 1, 2, 1, 1, 1); // arm bone along the top
  });
  b.part('head', [3, 1.5, 1.5], () => {
    b.box(2, 2, 1, 3, 2, 2, 1);
    b.setM(2, 3, 2, 3); // eyes
    b.setM(2, 2, 2, 4); // fangs
    b.setM(2, 4, 1, 1); // ears
  });
});

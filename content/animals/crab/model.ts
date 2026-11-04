import { defineModel } from '../../../tools/content-build/animal';

// Crab: wide vermilion shell, eyes on stalks, two big open claws in front and legs out to the sides.
export default defineModel([8, 4, 5], {
  1: ['body', '#F0563B'], // shell
  2: ['accent', '#C93A28'], // legs, claws
  3: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.box(2, 0, 1, 4, 2, 3, 1); // shell
  b.box(3, 2, 2, 2, 1, 1, 1); // shell top
  b.setM(2, 2, 3, 1); // eye stalks
  b.setM(2, 3, 3, 3); // eyes
  b.pair('leg', [1.5, 0.5, 1.5], () => {
    b.box(0, 0, 0, 2, 1, 1, 2);
    b.box(0, 0, 2, 2, 1, 1, 2);
  });
  b.pair('claw', [1.5, 1, 3], () => {
    b.box(1, 1, 3, 1, 1, 1, 2); // arm
    b.box(0, 1, 4, 2, 2, 1, 2); // pincer
    b.erase(1, 2, 4, 1, 1, 1); // open
  });
});

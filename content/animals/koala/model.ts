import { defineModel } from '../../../tools/content-build/animal';

// Koala: round grey body, a big head with fluffy round ears (light insides) and a tall dark nose.
export default defineModel([7, 6, 6], {
  1: ['body', '#9EA4AE'], // fur
  2: ['belly', '#E6E8EC'], // belly, inner ears
  3: ['eye', '#1E1E1E'], // eyes, nose
}, (b) => {
  b.pair('legF', [1.5, 0.5, 3], () => b.box(1, 0, 3, 2, 1, 1, 1));
  b.pair('legB', [1.5, 0.5, 0], () => b.box(1, 0, 0, 2, 1, 1, 1));
  b.box(1, 1, 0, 5, 3, 4, 1); // body
  b.box(2, 1, 3, 3, 2, 1, 2); // belly
  b.part('head', [3, 3.5, 3], () => {
    b.box(1, 3, 3, 5, 3, 3, 1); // big head
    b.box(3, 3, 5, 1, 2, 1, 3); // tall nose
    b.setM(2, 4, 5, 3); // eyes
  });
  b.pair('ear', [1, 4.5, 4], () => {
    b.box(0, 4, 3, 1, 2, 1, 1);
    b.box(0, 4, 4, 1, 2, 1, 2); // inside
  });
});

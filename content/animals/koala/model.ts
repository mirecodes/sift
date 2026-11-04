import { defineModel } from '../../../tools/content-build/animal';

// Koala: round grey body, a big round head with two well-spaced eyes, a dark nose below them and fluffy
// round ears with light insides.
export default defineModel([7, 7, 6], {
  1: ['body', '#9EA4AE'], // fur
  2: ['belly', '#E6E8EC'], // belly, inner ears
  3: ['eye', '#1E1E1E'], // eyes, nose
}, (b) => {
  b.pair('legF', [1.5, 0.5, 3], () => b.box(1, 0, 3, 2, 1, 1, 1));
  b.pair('legB', [1.5, 0.5, 0], () => b.box(1, 0, 0, 2, 1, 1, 1));
  b.box(2, 1, 0, 3, 3, 4, 1); // body
  b.box(3, 1, 3, 1, 2, 1, 2); // belly
  b.part('head', [3, 3.5, 3], () => {
    b.box(1, 3, 2, 5, 4, 4, 1); // big round head
    b.erase(1, 6, 2, 1, 1, 4);
    b.erase(5, 6, 2, 1, 1, 4);
    b.set(3, 3, 5, 3); // nose
    b.set(3, 4, 5, 3);
    b.setM(1, 5, 5, 3); // eyes, apart from the nose
  });
  b.pair('ear', [1, 5.5, 3.5], () => {
    b.box(0, 5, 3, 1, 2, 1, 1);
    b.box(0, 5, 4, 1, 2, 1, 2); // inside
  });
});

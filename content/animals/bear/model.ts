import { defineModel } from '../../../tools/content-build/animal';

// Bear: big heavy dark brown body with a shoulder hump on thick legs, a broad head with a light muzzle
// and small round ears. Stands up on its hind legs.
export default defineModel([7, 8, 12], {
  1: ['body', '#5E3B20'], // fur
  2: ['muzzle', '#B98552'], // muzzle
  3: ['eye', '#1E1E1E'], // eyes, nose
}, (b) => {
  b.pair('legF', [1.5, 2.5, 7.5], () => b.box(1, 0, 7, 2, 3, 2, 1));
  b.pair('legB', [1.5, 2.5, 1.5], () => b.box(1, 0, 1, 2, 3, 2, 1));
  b.box(1, 3, 1, 5, 4, 8, 1); // body
  b.box(2, 7, 5, 3, 1, 3, 1); // shoulder hump
  b.part('tail', [3, 5, 0.5], () => b.set(3, 5, 0, 1));
  b.part('head', [3, 5, 8.5], () => {
    b.box(1, 4, 9, 5, 3, 2, 1);
    b.box(2, 4, 11, 3, 2, 1, 2); // muzzle
    b.set(3, 5, 11, 3); // nose
    b.setM(2, 6, 10, 3); // eyes
  });
  b.pair('ear', [1.5, 6.5, 9.5], () => b.box(1, 7, 9, 1, 1, 1, 1));
});

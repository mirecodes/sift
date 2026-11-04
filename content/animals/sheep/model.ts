import { defineModel } from '../../../tools/content-build/animal';

// Sheep: fluffy white wool body with a bumpy top, a soft tan face with two clear eyes under a wool cap,
// tan ears and legs.
export default defineModel([5, 6, 8], {
  1: ['body', '#F4F4F0'], // wool
  2: ['accent', '#BFA898'], // face, ears, legs
  3: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.pair('legF', [1, 1.5, 5], () => b.box(1, 0, 5, 1, 2, 1, 2));
  b.pair('legB', [1, 1.5, 2], () => b.box(1, 0, 2, 1, 2, 1, 2));
  b.box(0, 2, 1, 5, 3, 6, 1); // wool
  b.box(1, 5, 2, 3, 1, 4, 1); // bumpy top
  b.erase(0, 4, 1, 1, 1, 1);
  b.erase(4, 4, 1, 1, 1, 1);
  b.part('tail', [2, 3.5, 0.5], () => b.set(2, 3, 0, 1));
  b.part('head', [2, 3.5, 6.5], () => {
    b.box(1, 2, 7, 3, 3, 1, 2); // face
    b.box(1, 5, 6, 3, 1, 2, 1); // wool cap
    b.setM(1, 4, 7, 3); // eyes
  });
  b.pair('ear', [0.5, 4, 7], () => b.set(0, 4, 7, 2));
});

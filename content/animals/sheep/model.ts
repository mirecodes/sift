import { defineModel } from '../../../tools/content-build/animal';

// Sheep: fluffy white wool body with a bumpy top, dark face, ears and legs, a wool cap on the head.
export default defineModel([6, 6, 8], {
  1: ['body', '#F4F4F0'], // wool
  2: ['accent', '#3A3A3A'], // face, ears, legs
  3: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.pair('legF', [1, 1.5, 5], () => b.box(1, 0, 5, 1, 2, 1, 2));
  b.pair('legB', [1, 1.5, 2], () => b.box(1, 0, 2, 1, 2, 1, 2));
  b.box(0, 2, 1, 6, 3, 5, 1); // wool
  b.box(1, 5, 2, 4, 1, 3, 1); // bumpy top
  b.erase(0, 4, 1, 1, 1, 1);
  b.erase(5, 4, 1, 1, 1, 1);
  b.part('tail', [2.5, 3.5, 0.5], () => b.box(2, 3, 0, 2, 1, 1, 1));
  b.part('head', [2.5, 3.5, 5.5], () => {
    b.box(2, 2, 6, 2, 3, 2, 2); // dark face
    b.box(1, 4, 5, 4, 1, 2, 1); // wool cap
    b.setM(2, 3, 7, 3); // eyes
  });
  b.pair('ear', [1.5, 3.5, 6], () => b.box(1, 3, 6, 1, 1, 1, 2));
});

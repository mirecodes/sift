import { defineModel } from '../../../tools/content-build/animal';

// Guinea pig: loaf-shaped cream body with orange patches, a round head as deep as it is wide, tiny pink
// ears and nose.
export default defineModel([5, 4, 7], {
  1: ['body', '#F7EFE2'], // coat
  2: ['accent', '#E8993E'], // patches
  3: ['eye', '#1E1E1E'], // eyes
  4: ['nose', '#F4A6B7'], // nose, ears
}, (b) => {
  b.pair('legF', [1, 0.5, 4], () => b.box(1, 0, 4, 1, 1, 1, 1));
  b.pair('legB', [1, 0.5, 1], () => b.box(1, 0, 1, 1, 1, 1, 1));
  b.box(0, 1, 0, 5, 2, 5, 1); // body
  b.box(1, 3, 0, 3, 1, 4, 1); // rounded back
  b.erase(0, 2, 0, 1, 1, 1);
  b.erase(4, 2, 0, 1, 1, 1);
  b.box(0, 1, 1, 1, 2, 2, 2); // patches
  b.box(4, 2, 2, 1, 1, 2, 2);
  b.box(1, 3, 1, 2, 1, 2, 2);
  b.part('head', [2, 2, 4], () => {
    b.box(1, 1, 4, 3, 3, 3, 1);
    b.box(1, 3, 4, 1, 1, 2, 2); // patch behind one eye
    b.setM(1, 3, 6, 3); // eyes
    b.set(2, 2, 6, 4); // nose
    b.setM(0, 3, 5, 4); // ears
  });
});

import { defineModel } from '../../../tools/content-build/animal';

// Chick: a round yellow fluff ball (no neck), a tiny beak, little wing stubs, a darker tuft on top and
// orange feet. Kept clearly apart from the Duck (long grey body, green head, wide bill).
export default defineModel([7, 5, 6], {
  1: ['body', '#FFE14D'], // fluff
  2: ['wing', '#F5C518'], // wing stubs
  3: ['beak', '#FF8C42'], // beak, feet
  4: ['accent', '#E8A800'], // tuft
  5: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.pair('leg', [2, 0.5, 2.5], () => b.box(2, 0, 2, 1, 1, 2, 3));
  b.box(1, 1, 0, 5, 2, 5, 1); // lower ball
  for (const [x, z] of [[1, 0], [5, 0], [1, 4], [5, 4]] as const) b.erase(x, 1, z, 1, 2, 1); // round corners
  b.pair('wing', [1, 2.5, 2], () => b.box(0, 1, 1, 1, 2, 2, 2));
  b.part('head', [3, 2.5, 2], () => {
    b.box(1, 3, 0, 5, 1, 5, 1); // upper ball
    for (const [x, z] of [[1, 0], [5, 0], [1, 4], [5, 4]] as const) b.erase(x, 3, z, 1, 1, 1);
    b.box(2, 4, 1, 3, 1, 3, 1); // dome
    b.set(3, 3, 5, 3); // beak
    b.setM(2, 4, 3, 5); // eyes
    b.set(3, 4, 1, 4); // tuft
    b.set(3, 4, 2, 4);
  });
});

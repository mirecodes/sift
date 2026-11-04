import { defineModel } from '../../../tools/content-build/animal';

// Ladybug: round red wing cases with black spots that open, black head with white eyes, little legs.
export default defineModel([6, 3, 6], {
  1: ['body', '#E63946'], // wing cases
  2: ['eye', '#1E1E1E'], // head, spots, legs
  3: ['accent', '#FFFFFF'], // eyes
}, (b) => {
  b.box(1, 0, 0, 4, 1, 5, 2); // underside
  for (const z of [1, 3]) b.setM(0, 0, z, 2); // legs
  b.pair('wing', [2.5, 2.5, 2.5], () => {
    b.box(1, 1, 0, 2, 2, 5, 1);
    b.erase(1, 2, 0, 1, 1, 1); // rounded back
    b.erase(1, 2, 4, 1, 1, 1);
    b.set(2, 2, 1, 2); // spots
    b.set(1, 2, 3, 2);
    b.set(1, 1, 1, 2);
  });
  b.part('head', [2.5, 0.5, 4.5], () => {
    b.box(2, 0, 5, 2, 2, 1, 2);
    b.set(2, 1, 5, 3); // eyes
    b.set(3, 1, 5, 3);
  });
});

import { defineModel } from '../../../tools/content-build/animal';

// Fish: upright orange body with a light belly, one eye on each side, a dorsal fin, side fins that
// paddle and a tail fan that never stops.
export default defineModel([5, 5, 7], {
  1: ['body', '#FF8C42'], // body
  2: ['belly', '#FFC48A'], // belly
  3: ['accent', '#E56A1F'], // fins
  4: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.box(1, 1, 1, 3, 3, 5, 1); // body
  b.erase(1, 3, 1, 1, 1, 1); // tapered back
  b.erase(3, 3, 1, 1, 1, 1);
  b.box(1, 1, 2, 3, 1, 3, 2); // belly
  b.box(2, 1, 6, 1, 2, 1, 1); // snout
  b.setM(1, 3, 5, 4); // eyes, one on each side
  b.box(2, 4, 2, 1, 1, 2, 3); // dorsal fin
  b.box(2, 0, 3, 1, 1, 1, 3); // belly fin
  b.pair('fin', [1, 2, 4], () => b.box(0, 1, 3, 1, 1, 2, 3));
  b.part('tail', [2, 2, 0.5], () => {
    b.box(2, 1, 0, 1, 3, 1, 3);
    b.set(2, 0, 0, 3);
    b.set(2, 4, 0, 3);
  });
});

import { defineModel } from '../../../tools/content-build/animal';

// Fish: upright orange body with a light belly, dorsal fin, side fins that paddle and a tail fan that
// never stops.
export default defineModel([4, 5, 7], {
  1: ['body', '#FF8C42'], // body
  2: ['belly', '#FFC48A'], // belly
  3: ['accent', '#E56A1F'], // fins
  4: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.box(1, 1, 1, 2, 3, 5, 1); // body
  b.box(1, 1, 2, 2, 1, 3, 2); // belly
  b.box(1, 1, 6, 2, 2, 1, 1); // snout
  b.set(1, 3, 5, 4); // eyes
  b.set(2, 3, 5, 4);
  b.box(1, 4, 2, 2, 1, 2, 3); // dorsal fin
  b.box(1, 0, 3, 2, 1, 1, 3); // belly fin
  b.pair('fin', [1, 2, 4], () => b.box(0, 1, 3, 1, 1, 2, 3));
  b.part('tail', [1.5, 2, 0.5], () => b.box(1, 0, 0, 2, 5, 1, 3));
});

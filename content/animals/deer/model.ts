import { defineModel } from '../../../tools/content-build/animal';

// Deer: tan body on long slim legs with white spots, a white tail, a raised head and branching antlers.
export default defineModel([5, 10, 10], {
  1: ['body', '#B9824F'], // coat
  2: ['belly', '#FFFFFF'], // spots, tail, belly
  3: ['horn', '#6B4A2B'], // antlers, hooves
  4: ['eye', '#1E1E1E'], // eyes
  5: ['nose', '#3A2A20'], // nose
}, (b) => {
  const leg = (z: number) => {
    b.box(1, 0, z, 1, 4, 1, 1);
    b.set(1, 0, z, 3);
  };
  b.pair('legF', [1, 3.5, 7], () => leg(7));
  b.pair('legB', [1, 3.5, 2], () => leg(2));
  b.box(1, 4, 1, 3, 3, 7, 1); // body
  b.box(2, 4, 2, 1, 1, 5, 2); // belly
  for (const [x, z] of [[1, 3], [3, 5], [2, 4], [1, 6]] as const) b.set(x, 6, z, 2); // spots
  b.part('tail', [2, 6, 0.5], () => b.set(2, 6, 0, 2));
  b.part('head', [2, 6.5, 7], () => {
    b.box(2, 7, 7, 1, 1, 1, 1); // neck
    b.box(1, 7, 8, 3, 2, 1, 1);
    b.box(2, 7, 9, 1, 1, 1, 5); // nose
    b.setM(1, 8, 8, 4); // eyes
    b.setM(0, 8, 7, 1); // ears
    b.setM(1, 9, 7, 3); // antlers
    b.setM(0, 9, 8, 3);
  });
});

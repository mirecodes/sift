import { defineModel } from '../../../tools/content-build/animal';

// Hedgehog: brown body under a dome of dark spikes, a tan pointed face with a black nose.
export default defineModel([5, 4, 7], {
  1: ['muzzle', '#D9B88F'], // face
  2: ['accent', '#4E3B2A'], // spikes
  3: ['body', '#8B6B4A'], // body
  4: ['nose', '#2B2B2B'], // nose
  5: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  b.pair('legF', [1, 0.5, 4], () => b.box(1, 0, 4, 1, 1, 1, 3));
  b.pair('legB', [1, 0.5, 1], () => b.box(1, 0, 1, 1, 1, 1, 3));
  b.box(0, 1, 0, 5, 1, 5, 3); // body
  b.box(0, 2, 0, 5, 1, 5, 2); // spikes
  b.box(1, 3, 0, 3, 1, 4, 2);
  for (const [x, z] of [[0, 0], [4, 0]] as const) b.erase(x, 2, z, 1, 1, 1);
  b.set(2, 3, 4, 3); // crown peeking out
  b.part('head', [2, 1.5, 4.5], () => {
    b.box(1, 1, 5, 3, 2, 1, 1);
    b.set(2, 1, 6, 4); // pointed nose
    b.setM(1, 2, 5, 5); // eyes
  });
});

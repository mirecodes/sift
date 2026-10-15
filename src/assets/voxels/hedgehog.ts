import { defineModel } from './builder';

// Hedgehog: brown body under dark spikes, tan face.
export const hedgehog = defineModel([5, 4, 6], {
  1: ['muzzle', '#D9B88F'], // face
  2: ['accent', '#4E3B2A'], // spikes
  3: ['body', '#8B6B4A'], // body
  4: ['nose', '#2B2B2B'], // nose
  5: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.box(0, 0, 0, 5, 2, 4, 3); // lower body
  b.box(0, 2, 0, 5, 1, 4, 2); // spikes
  b.box(1, 3, 0, 3, 1, 4, 2); // spikes top
  b.box(1, 0, 4, 3, 2, 2, 1); // face
  b.box(1, 2, 4, 3, 1, 1, 2); // forehead spikes
  b.set(2, 0, 5, 4); // nose
  b.setM(1, 1, 5, 5); // eyes
});

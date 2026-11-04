import { defineModel } from '../../../tools/content-build/animal';

// Bee: round yellow body with black stripes, a yellow face with big eyes, antennae and pale wings on top
// that buzz.
export default defineModel([5, 4, 6], {
  1: ['body', '#FFD93D'], // body, face
  2: ['eye', '#1E1E1E'], // stripes, eyes, antennae, stinger
  3: ['wing', '#D6EEFF'], // wings
}, (b) => {
  b.box(1, 0, 0, 3, 3, 5, 1); // body
  b.box(1, 0, 1, 3, 3, 1, 2); // stripes
  b.box(1, 0, 3, 3, 3, 1, 2);
  b.set(2, 1, 0, 2); // stinger end
  b.box(1, 0, 5, 3, 2, 1, 1); // face
  b.setM(1, 1, 5, 2); // eyes
  b.setM(1, 2, 5, 2); // antennae
  b.setM(0, 3, 5, 2);
  b.pair('wing', [1.5, 3, 2], () => b.box(0, 3, 1, 2, 1, 3, 3));
});

import { defineModel } from '../../../tools/content-build/animal';

// Bee: yellow body with black stripes, pale wings and two antennae.
export default defineModel([5, 4, 5], {
  1: ['body', '#FFD93D'], // body
  2: ['eye', '#1E1E1E'], // stripes, eyes, antennae
  3: ['wing', '#D6EEFF'], // wings
}, (b) => {
  b.box(1, 0, 0, 3, 3, 4, 1); // body
  b.box(1, 0, 1, 3, 3, 1, 2); // stripes
  b.box(1, 0, 3, 3, 3, 1, 2);
  b.box(1, 0, 4, 3, 3, 1, 1); // head
  b.setM(1, 1, 4, 2); // eyes
  b.setM(1, 3, 4, 2); // antennae
  b.boxM(0, 2, 1, 1, 2, 2, 3); // wings
});

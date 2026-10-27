import { defineModel } from '../../../tools/content-build/animal';

// Hamster: chubby tan blob with white belly and pink ears.
export default defineModel([5, 4, 5], {
  1: ['body', '#E0B27A'], // fur
  2: ['belly', '#FFFFFF'], // belly
  3: ['nose', '#F4A6B7'], // ears, nose
  4: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.box(0, 0, 0, 5, 2, 5, 1); // lower body
  b.box(1, 2, 0, 3, 1, 5, 1); // upper body
  b.box(1, 3, 3, 3, 1, 2, 1); // head top
  b.box(1, 0, 4, 3, 2, 1, 2); // belly
  b.setM(1, 3, 3, 3); // ears
  b.set(2, 2, 4, 3); // nose
  b.setM(1, 2, 4, 4); // eyes
});

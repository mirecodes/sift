import { defineModel } from '../../../tools/content-build/animal';

// Red panda: rust fur on dark legs, a white face with cheeks and ear tips, and a tall ringed tail.
export default defineModel([5, 8, 10], {
  1: ['body', '#C4542D'], // fur
  2: ['muzzle', '#FFFFFF'], // face markings
  3: ['eye', '#1E1E1E'], // eyes, nose
  4: ['accent', '#4A2A1F'], // legs, rings
  5: ['accent2', '#E8B27A'], // light rings
}, (b) => {
  b.pair('legF', [1, 1.5, 6], () => b.box(1, 0, 6, 1, 2, 1, 4));
  b.pair('legB', [1, 1.5, 2], () => b.box(1, 0, 2, 1, 2, 1, 4));
  b.box(1, 2, 2, 3, 3, 5, 1); // body
  // A slim tail: one voxel thick, sweeping back and curving up, with light rings.
  b.part('tail', [2, 3.5, 1.5], () => {
    b.box(2, 3, 0, 1, 1, 2, 1);
    b.set(2, 3, 0, 5); // ring
  });
  b.part('tail2', [2, 3.5, 0], () => {
    b.box(2, 4, 0, 1, 3, 1, 1);
    b.set(2, 5, 0, 5); // ring
    b.set(2, 6, 0, 4); // dark tip
  });
  b.part('head', [2, 4, 6.5], () => {
    b.box(0, 4, 7, 5, 3, 2, 1);
    b.box(1, 4, 8, 3, 1, 1, 2); // muzzle
    b.setM(0, 5, 8, 2); // cheeks
    b.setM(1, 5, 8, 3); // eyes
    b.set(2, 4, 9, 3); // nose
  });
  b.pair('ear', [0.5, 6.5, 7.5], () => b.box(0, 7, 7, 1, 1, 1, 2));
});

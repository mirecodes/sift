import { defineModel } from '../../../tools/content-build/animal';

// Cow: long white body with black patches, dark hooves, a rounded head with two eyes apart, a pink snout,
// small horns, side ears and a tufted tail. Narrower than before so it reads long, not wide.
export default defineModel([6, 8, 12], {
  1: ['body', '#F7F7F2'], // coat
  2: ['accent', '#2B2B2B'], // patches, hooves, tail tuft
  3: ['nose', '#F4A6B7'], // snout
  4: ['horn', '#F3E6C4'], // horns
  5: ['eye', '#1E1E1E'], // eyes
}, (b) => {
  const leg = (z: number) => {
    b.box(1, 0, z, 1, 3, 1, 1);
    b.set(1, 0, z, 2);
  };
  b.pair('legF', [1, 2.5, 8], () => leg(8));
  b.pair('legB', [1, 2.5, 2], () => leg(2));
  b.box(1, 3, 1, 4, 3, 8, 1); // body
  b.box(1, 4, 2, 1, 2, 2, 2); // patches
  b.box(4, 3, 5, 1, 2, 3, 2);
  b.box(2, 5, 3, 2, 1, 2, 2);
  b.box(3, 5, 7, 2, 1, 1, 2);
  b.part('tail', [2.5, 5, 0.5], () => {
    b.box(2, 2, 0, 1, 4, 1, 1);
    b.set(2, 2, 0, 2); // tuft
  });
  b.part('head', [2.5, 5, 8.5], () => {
    b.box(1, 4, 8, 4, 3, 3, 1);
    b.box(1, 6, 8, 2, 1, 1, 2); // patch
    b.box(2, 4, 11, 2, 2, 1, 3); // snout
    b.setM(1, 6, 10, 5); // eyes
    b.setM(1, 7, 9, 4); // horns
  });
  b.pair('ear', [0.5, 6, 9.5], () => b.box(0, 6, 9, 1, 1, 1, 1));
});

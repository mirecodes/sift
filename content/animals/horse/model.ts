import { defineModel } from '../../../tools/content-build/animal';

// Horse: long chestnut body on tall legs with dark hooves, a raised neck and narrow head, a dark mane
// running down the neck and a long hanging tail.
export default defineModel([4, 10, 11], {
  1: ['body', '#A0522D'], // coat
  2: ['mane', '#3B2416'], // mane, tail, hooves
  3: ['eye', '#1E1E1E'], // eyes
  4: ['muzzle', '#C97A4A'], // muzzle
}, (b) => {
  const leg = (z: number) => {
    b.box(0, 0, z, 1, 3, 1, 1);
    b.set(0, 0, z, 2);
  };
  b.pair('legF', [0, 2.5, 7], () => leg(7));
  b.pair('legB', [0, 2.5, 2], () => leg(2));
  b.box(0, 3, 1, 4, 3, 8, 1); // body
  b.part('tail', [1.5, 5, 0.5], () => b.box(1, 2, 0, 2, 4, 1, 2));
  b.part('head', [1.5, 6, 8], () => {
    b.box(1, 6, 8, 2, 1, 1, 1); // neck
    b.box(1, 7, 8, 2, 2, 2, 1); // head
    b.box(1, 6, 10, 2, 2, 1, 4); // muzzle
    b.setM(1, 8, 9, 3); // eyes
    b.setM(1, 9, 8, 1); // ears
    b.box(1, 6, 7, 2, 3, 1, 2); // mane down the neck
    b.box(1, 9, 9, 2, 1, 1, 2); // forelock
  });
});

import { defineModel } from '../../../tools/content-build/animal';

// Horse: long chestnut body on tall legs with dark hooves, a raised neck, a head with one eye on each
// side and a narrow muzzle, a dark mane down the neck and a long hanging tail.
export default defineModel([5, 10, 11], {
  1: ['body', '#A0522D'], // coat
  2: ['mane', '#3B2416'], // mane, tail, hooves
  3: ['eye', '#1E1E1E'], // eyes
  4: ['muzzle', '#C97A4A'], // muzzle
}, (b) => {
  const leg = (z: number) => {
    b.box(1, 0, z, 1, 3, 1, 1);
    b.set(1, 0, z, 2);
  };
  b.pair('legF', [1, 2.5, 7], () => leg(7));
  b.pair('legB', [1, 2.5, 2], () => leg(2));
  b.box(1, 3, 1, 3, 3, 8, 1); // body
  b.part('tail', [2, 5, 0.5], () => b.box(2, 2, 0, 1, 4, 1, 2));
  b.part('head', [2, 6, 8], () => {
    b.box(1, 6, 8, 3, 1, 1, 1); // neck
    b.box(1, 7, 8, 3, 2, 2, 1); // head
    b.box(2, 6, 10, 1, 2, 1, 4); // narrow muzzle
    b.setM(1, 8, 9, 3); // eyes, one on each side
    b.setM(1, 9, 8, 1); // ears
    b.box(2, 6, 7, 1, 3, 1, 2); // mane down the neck
    b.set(2, 9, 9, 2); // forelock
  });
});

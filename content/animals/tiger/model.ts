import { defineModel } from '../../../tools/content-build/animal';

// Tiger: long and low, orange with black stripes, white muzzle, belly and paws, a 王-style forehead mark
// and a tail that curls up at the tip. 12 deep (Legendary, ADR-055).
export default defineModel([6, 10, 12], {
  1: ['body', '#F28C28'], // fur
  2: ['eye', '#1E1E1E'], // stripes, eyes, forehead mark
  3: ['belly', '#FFFFFF'], // muzzle, belly, paws
  4: ['nose', '#F4A6B7'], // nose
}, (b) => {
  const leg = (z: number, stripeY: number) => {
    b.box(0, 0, z, 2, 3, 2, 1);
    b.box(0, 0, z, 2, 1, 2, 3); // paw
    b.box(0, stripeY, z, 1, 1, 2, 2); // stripe on the outside
  };
  b.pair('legF', [0.5, 2.5, 8.5], () => leg(8, 2));
  b.pair('legB', [0.5, 2.5, 2.5], () => leg(2, 1));
  b.box(0, 3, 2, 6, 4, 8, 1); // long body
  b.box(1, 3, 3, 4, 1, 6, 3); // belly
  for (const z of [3, 5, 7]) {
    b.boxM(0, 4, z, 1, 3, 1, 2); // side stripes
    b.box(1, 6, z, 4, 1, 1, 2); // over the back
  }
  b.part('tail', [2.5, 5, 1.5], () => {
    b.box(2, 5, 0, 2, 1, 2, 1);
    b.box(2, 5, 0, 2, 1, 1, 2); // stripe
  });
  b.part('tail2', [2.5, 5.5, 0], () => {
    b.box(2, 6, 0, 2, 2, 1, 1);
    b.box(2, 7, 0, 2, 1, 1, 2); // black tip
  });
  b.part('head', [2.5, 5, 8], () => {
    b.box(0, 5, 8, 6, 4, 3, 1); // head
    b.box(1, 5, 11, 4, 2, 1, 3); // muzzle
    b.box(2, 6, 11, 2, 1, 1, 4); // nose
    b.setM(1, 7, 10, 2); // eyes
    b.box(1, 8, 10, 4, 1, 1, 2); // 王: top bar
    b.box(2, 8, 8, 2, 1, 2, 2); // 王: stroke back over the head
    b.setM(0, 6, 9, 2); // cheek stripes
    b.setM(0, 7, 8, 2);
  });
  b.pair('ear', [0.5, 8.5, 9], () => {
    b.box(0, 9, 9, 2, 1, 1, 1);
    b.set(0, 9, 9, 2); // dark tip
  });
});

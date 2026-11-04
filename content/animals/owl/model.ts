import { defineModel } from '../../../tools/content-build/animal';

// Owl: round brown body, cream belly, a big head with yellow eye discs, a little beak and ear tufts.
export default defineModel([5, 7, 5], {
  1: ['body', '#8B5E3C'], // plumage
  2: ['belly', '#F1E2C6'], // belly
  3: ['accent', '#FFD23F'], // eye discs
  4: ['eye', '#1E1E1E'], // pupils
  5: ['beak', '#F2A93B'], // beak, feet
  6: ['wing', '#5E3B20'], // wings, tail
}, (b) => {
  b.pair('leg', [1, 0.5, 3], () => b.box(1, 0, 3, 1, 1, 1, 5));
  b.box(1, 1, 1, 3, 3, 3, 1); // body
  b.box(1, 1, 3, 3, 3, 1, 2); // belly
  b.pair('wing', [0.5, 3.5, 2], () => b.box(0, 1, 1, 1, 3, 2, 6));
  b.part('tail', [2, 1.5, 0.5], () => b.box(1, 1, 0, 3, 1, 1, 6));
  b.part('head', [2, 3.5, 2], () => {
    b.box(0, 4, 1, 5, 2, 3, 1); // big head
    b.boxM(0, 4, 3, 2, 2, 1, 3); // eye discs
    b.setM(1, 4, 3, 4); // pupils
    b.set(2, 4, 3, 5); // beak
    b.set(2, 5, 3, 2);
    b.setM(0, 6, 2, 1); // ear tufts
  });
});

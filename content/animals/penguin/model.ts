import { defineModel } from '../../../tools/content-build/animal';

// Penguin: dark blue-black back, white belly and cheeks, flippers that flap, orange beak and feet.
export default defineModel([5, 6, 4], {
  1: ['body', '#2B3A55'], // back, head, flippers
  2: ['belly', '#F5F5F5'], // belly, cheeks
  3: ['eye', '#1E1E1E'], // eyes
  4: ['beak', '#F2A93B'], // beak, feet
}, (b) => {
  b.pair('leg', [1, 0.5, 2], () => b.box(1, 0, 2, 1, 1, 2, 4));
  b.box(1, 1, 0, 3, 3, 3, 1); // body
  b.box(1, 1, 2, 3, 3, 1, 2); // belly
  b.pair('wing', [0.5, 3.5, 1], () => b.box(0, 1, 1, 1, 3, 1, 1)); // flippers
  b.part('head', [2, 3.5, 1], () => {
    b.box(1, 4, 0, 3, 2, 3, 1);
    b.boxM(1, 4, 2, 1, 2, 1, 2); // cheeks
    b.setM(1, 5, 2, 3); // eyes
    b.set(2, 4, 3, 4); // beak
  });
});

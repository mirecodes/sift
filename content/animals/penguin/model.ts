import { defineModel } from '../../../tools/content-build/animal';

// Penguin: dark blue-black back, white belly and cheeks, orange beak and feet.
export default defineModel([5, 6, 5], {
  1: ['body', '#2B3A55'], // back, head
  2: ['belly', '#F5F5F5'], // belly, cheeks
  3: ['eye', '#1E1E1E'], // eye
  4: ['beak', '#F2A93B'], // beak, feet
}, (b) => {
  b.boxM(1, 0, 1, 1, 1, 3, 4); // feet
  b.box(1, 1, 0, 3, 3, 4, 1); // body
  b.boxM(0, 1, 1, 1, 2, 2, 1); // flippers
  b.box(1, 1, 3, 3, 3, 1, 2); // belly
  b.box(1, 4, 0, 3, 2, 4, 1); // head
  b.setM(1, 4, 3, 2); // cheeks
  b.set(2, 4, 4, 4); // beak
  b.setM(1, 5, 3, 3); // eyes
});

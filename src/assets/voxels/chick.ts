import { defineModel } from './builder';

// Chick: round yellow body, orange beak and feet.
export const chick = defineModel([4, 4, 4], {
  1: ['body', '#FFD93D'], // body
  2: ['beak', '#FF8C42'], // beak, feet
  3: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.boxM(1, 0, 1, 1, 1, 2, 2); // feet
  b.box(0, 1, 0, 4, 2, 3, 1); // body
  b.box(1, 3, 0, 2, 1, 3, 1); // head top
  b.box(1, 2, 3, 2, 1, 1, 2); // beak
  b.setM(0, 2, 2, 3); // eyes
});

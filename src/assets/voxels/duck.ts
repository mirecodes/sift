import { defineModel } from './builder';

// Duck: yellow body with darker wings, orange bill and feet.
export const duck = defineModel([4, 5, 5], {
  1: ['body', '#FFD93D'], // body
  2: ['beak', '#FF8C42'], // bill, feet
  3: ['eye', '#1E1E1E'], // eye
  4: ['wing', '#F2C230'], // wings
}, (b) => {
  b.boxM(1, 0, 1, 1, 1, 2, 2); // feet
  b.box(0, 1, 0, 4, 2, 4, 1); // body
  b.boxM(0, 1, 1, 1, 1, 2, 4); // wings
  b.box(0, 3, 2, 4, 2, 2, 1); // head
  b.box(1, 3, 0, 2, 1, 1, 1); // tail feathers
  b.box(1, 3, 4, 2, 1, 1, 2); // bill
  b.setM(0, 4, 3, 3); // eyes
});

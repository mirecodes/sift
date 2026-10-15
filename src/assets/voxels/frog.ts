import { defineModel } from './builder';

// Frog: green crouching body, light belly, bulging eyes.
export const frog = defineModel([5, 3, 5], {
  1: ['body', '#5DBB4B'], // body
  2: ['belly', '#C9F0A8'], // belly
  3: ['accent', '#4A9E3C'], // hind legs
  4: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.box(0, 0, 0, 5, 2, 5, 1); // body
  b.erase(0, 1, 0, 1, 1, 1);
  b.erase(4, 1, 0, 1, 1, 1);
  b.boxM(0, 0, 0, 1, 1, 3, 3); // hind legs
  b.box(1, 0, 4, 3, 2, 1, 2); // belly
  b.setM(1, 2, 3, 1); // eye bumps
  b.setM(1, 2, 4, 4); // eyes
});

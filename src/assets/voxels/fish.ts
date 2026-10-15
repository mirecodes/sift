import { defineModel } from './builder';

// Fish: orange body with light belly, tail fin, dorsal and side fins.
export const fish = defineModel([3, 5, 6], {
  1: ['body', '#FF8C42'], // body
  2: ['belly', '#FFC48A'], // belly
  3: ['accent', '#E56A1F'], // fins
  4: ['eye', '#1E1E1E'], // eye
}, (b) => {
  b.box(0, 1, 2, 3, 1, 3, 2); // belly
  b.box(0, 2, 2, 3, 1, 3, 1); // body
  b.box(1, 3, 2, 1, 1, 3, 1); // back ridge
  b.box(1, 1, 1, 1, 2, 1, 1); // tail stalk
  b.box(1, 1, 5, 1, 2, 1, 1); // head
  b.box(1, 0, 0, 1, 4, 1, 3); // tail fin
  b.box(1, 4, 2, 1, 1, 2, 3); // dorsal fin
  b.set(1, 0, 3, 3); // belly fin
  b.setM(0, 1, 3, 3); // side fins
  b.setM(0, 2, 4, 4); // eyes
});

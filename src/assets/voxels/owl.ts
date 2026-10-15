import { defineModel } from './builder';

// Owl: brown body, cream belly, big round yellow eyes and ear tufts.
export const owl = defineModel([5, 6, 5], {
  1: ['body', '#8B5E3C'], // feathers
  2: ['belly', '#F1E2C6'], // belly, face disc
  3: ['accent', '#FFD23F'], // eye
  4: ['eye', '#1E1E1E'], // pupil
  5: ['beak', '#F2A93B'], // beak, feet
  6: ['wing', '#5E3B20'], // wings, tufts
}, (b) => {
  b.box(0, 0, 0, 5, 3, 4, 1); // body
  b.box(1, 0, 3, 3, 3, 1, 2); // belly
  b.boxM(0, 0, 0, 1, 3, 3, 6); // wings
  b.boxM(1, 0, 4, 1, 1, 1, 5); // feet
  b.box(0, 3, 0, 5, 2, 4, 1); // head
  b.boxM(0, 3, 3, 2, 2, 1, 3); // eyes
  b.box(2, 3, 3, 1, 2, 1, 2); // face disc
  b.setM(1, 4, 3, 4); // pupils
  b.set(2, 3, 4, 5); // beak
  b.boxM(0, 5, 1, 1, 1, 2, 6); // ear tufts
});

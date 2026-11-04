import { defineModel } from '../../../tools/content-build/animal';

// Peacock: teal body and slim neck, blue wings, a small head with one eye on each side, a gold crest
// and a big green tail trailing behind with gold eye spots. On display it raises the tail into a fan.
const TAIL_ROWS: readonly (readonly [z: number, from: number])[] = [[3, 2], [2, 1], [1, 0], [0, 0]];

export default defineModel([7, 10, 9], {
  1: ['body', '#1FA8A0'], // body, neck
  2: ['accent', '#2B6FD0'], // wings, eye-spot centers
  3: ['eye', '#1E1E1E'], // eyes
  4: ['accent2', '#FFC933'], // crest, eye spots
  5: ['accent3', '#5FBF78'], // tail
  6: ['beak', '#F2A93B'], // beak, feet
}, (b) => {
  b.pair('leg', [2, 1.5, 5], () => b.box(2, 0, 5, 1, 2, 1, 6));
  b.box(2, 2, 4, 3, 3, 3, 1); // body
  b.pair('wing', [1.5, 3.5, 5], () => b.box(1, 2, 4, 1, 2, 3, 2));
  b.part('tail', [3, 2.5, 3.5], () => {
    for (const [z, from] of TAIL_ROWS) {
      for (let x = from; x < 7 - from; x++) {
        const spot = z < 3 && (x + z * 2) % 3 === 0;
        b.set(x, 2, z, spot ? (z === 0 ? 2 : 4) : 5);
      }
    }
  });
  b.part('head', [3, 4.5, 6.5], () => {
    b.box(3, 5, 6, 1, 3, 1, 1); // neck
    b.box(2, 8, 6, 3, 1, 2, 1); // head
    b.set(3, 8, 8, 6); // beak
    b.setM(2, 8, 7, 3); // eyes, one on each side
    b.set(3, 9, 6, 4); // crest
    b.set(3, 9, 7, 4);
  });
});

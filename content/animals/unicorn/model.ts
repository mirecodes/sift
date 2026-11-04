import { defineModel } from '../../../tools/content-build/animal';

// Unicorn: long white body on tall legs with gold hooves, a gold horn, a rainbow mane down the neck and
// back and a rainbow tail. 12 deep (Legendary, ADR-055); rears up on its hind legs.
export default defineModel([5, 12, 12], {
  1: ['body', '#FFFFFF'], // coat
  2: ['horn', '#FFD24D'], // horn, hooves
  3: ['eye', '#1E1E1E'], // eyes
  4: ['rainbow1', '#FF5A5F'], // rainbow red
  5: ['rainbow2', '#FFA24D'], // rainbow orange
  6: ['rainbow3', '#FFE14D'], // rainbow yellow
  7: ['rainbow4', '#5ED67A'], // rainbow green
  8: ['rainbow5', '#4DA6FF'], // rainbow blue
}, (b) => {
  const leg = (z: number) => {
    b.box(1, 0, z, 1, 4, 1, 1);
    b.set(1, 0, z, 2); // hoof
  };
  b.pair('legF', [1, 3.5, 8], () => leg(8));
  b.pair('legB', [1, 3.5, 2], () => leg(2));
  b.box(1, 4, 1, 3, 3, 8, 1); // body
  b.box(1, 7, 3, 3, 1, 2, 7); // mane along the back
  b.box(1, 7, 1, 3, 1, 2, 8);
  b.part('tail', [2, 6, 0.5], () => {
    b.box(1, 6, 0, 3, 1, 1, 4);
    b.box(1, 5, 0, 3, 1, 1, 5);
    b.box(1, 4, 0, 3, 1, 1, 6);
    b.box(1, 3, 0, 3, 1, 1, 7);
    b.box(1, 2, 0, 3, 1, 1, 8);
  });
  b.part('head', [2, 7, 7.5], () => {
    b.box(1, 7, 7, 3, 1, 2, 1); // neck
    b.box(1, 8, 8, 3, 2, 3, 1); // head
    b.box(1, 7, 11, 3, 2, 1, 1); // muzzle
    b.setM(1, 9, 10, 3); // eyes
    b.box(2, 10, 10, 1, 2, 1, 2); // horn
    b.setM(1, 10, 8, 1); // ears
    b.box(1, 10, 9, 3, 1, 1, 4); // mane from the crown down the neck
    b.box(1, 9, 7, 3, 1, 1, 5);
    b.box(1, 8, 6, 3, 1, 1, 6);
    b.box(1, 7, 5, 3, 1, 1, 7);
  });
});

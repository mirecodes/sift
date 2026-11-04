import { model } from '../../../tools/content-build/dsl';

// Stone statue: a sitting rabbit on a pedestal.
export default model([8, 17, 8], { stone: '#B4B8BF', stoneDark: '#7D828C' }, (m) => {
  m.paint('stoneDark');
  m.box(0, 0, 0, 8, 1, 8);
  m.box(1, 1, 1, 6, 3, 6);
  m.paint('stone');
  m.box(2, 4, 2, 4, 5, 4); // body
  m.box(2, 4, 5, 4, 2, 2); // front paws
  m.box(2, 9, 3, 4, 3, 3); // head
  m.mirrorX(() => m.box(2, 12, 4, 1, 5, 1)); // ears
  m.box(3, 5, 1, 2, 2, 1); // tail
  m.paint('stoneDark');
  m.mirrorX(() => m.set(2, 10, 6)); // eyes
});

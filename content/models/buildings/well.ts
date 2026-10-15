import { model } from '../../../tools/content-build/dsl';

// Well: round stone wall around water, two posts and a little roof.
export default model([8, 13, 8], { stone: '#9A9DA3', stoneDark: '#6E7179', water: '#4FA8E8', wood: '#B98552', roof: '#8A5A36' }, (m) => {
  m.paint('stone');
  m.cylinder(4, 0, 4, 3.6, 5);
  m.paint('stoneDark');
  m.cylinder(4, 4, 4, 3.6, 1);
  m.erase(2, 1, 2, 4, 4, 4);
  m.paint('water');
  m.box(2, 2, 2, 4, 1, 4);
  m.paint('wood');
  m.mirrorX(() => m.box(0, 5, 3, 1, 6, 2));
  m.box(1, 9, 3, 6, 1, 2);
  m.paint('roof');
  m.box(0, 11, 2, 8, 1, 4);
  m.box(1, 12, 3, 6, 1, 2);
});

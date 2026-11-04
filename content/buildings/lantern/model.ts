import { model } from '../../../tools/content-build/dsl';

// Lantern: stone foot, wooden post, metal lamp with a warm flame behind glass.
export default model([6, 15, 6], { stone: '#9A9DA3', woodDark: '#5E3B20', metal: '#3A3F4A', glass: '#FFE7A8', flame: '#FFB33D' }, (m) => {
  m.paint('stone');
  m.box(1, 0, 1, 4, 1, 4);
  m.paint('woodDark');
  m.box(2, 1, 2, 2, 8, 2);
  m.paint('metal');
  m.box(1, 9, 1, 4, 1, 4);
  m.box(1, 13, 1, 4, 1, 4);
  m.box(2, 14, 2, 2, 1, 2);
  m.mirrorX(() => {
    m.box(1, 10, 1, 1, 3, 1);
    m.box(1, 10, 4, 1, 3, 1);
  });
  m.paint('glass');
  m.box(2, 10, 1, 2, 3, 1);
  m.box(2, 10, 4, 2, 3, 1);
  m.box(1, 10, 2, 1, 3, 2);
  m.box(4, 10, 2, 1, 3, 2);
  m.paint('flame');
  m.box(2, 10, 2, 2, 2, 2);
});

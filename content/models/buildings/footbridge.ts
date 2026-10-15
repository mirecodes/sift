import { model } from '../../../tools/content-build/dsl';

// Footbridge: a slightly arched plank deck with low rails, laid across a stream (along z).
export default model([8, 5, 8], { wood: '#B98552', woodDark: '#8A5A36' }, (m) => {
  m.paint('wood');
  m.box(1, 0, 0, 6, 1, 2);
  m.box(1, 1, 2, 6, 1, 4);
  m.box(1, 0, 6, 6, 1, 2);
  m.paint('woodDark');
  m.mirrorX(() => {
    m.box(0, 0, 0, 1, 3, 1);
    m.box(0, 0, 7, 1, 3, 1);
    m.box(0, 1, 3, 1, 4, 1);
    m.box(0, 3, 1, 1, 1, 6);
  });
});

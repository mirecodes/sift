import { model } from '../../../tools/content-build/dsl';

// Fence segment: two posts and two rails along x, one tile wide.
export default model([8, 7, 2], { wood: '#B98552', woodDark: '#8A5A36' }, (m) => {
  m.paint('woodDark');
  m.mirrorX(() => m.box(0, 0, 0, 2, 7, 2));
  m.paint('wood');
  m.box(2, 2, 0, 4, 1, 1);
  m.box(2, 5, 0, 4, 1, 1);
});

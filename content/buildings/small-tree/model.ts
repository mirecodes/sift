import { model } from '../../../tools/content-build/dsl';

// Small tree: a short trunk under a blocky crown with darker leaves underneath.
export default model([8, 14, 8], { wood: '#8A5A36', leaf: '#6CC04A', leafDark: '#4E9A3A' }, (m) => {
  m.paint('wood');
  m.box(3, 0, 3, 2, 6, 2);
  m.paint('leafDark');
  m.box(1, 5, 1, 6, 2, 6);
  m.paint('leaf');
  m.box(0, 7, 1, 8, 4, 6);
  m.box(1, 7, 0, 6, 4, 8);
  m.box(1, 11, 1, 6, 2, 6);
  m.box(2, 13, 2, 4, 1, 4);
});

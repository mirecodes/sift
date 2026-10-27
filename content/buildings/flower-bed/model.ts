import { model } from '../../../tools/content-build/dsl';

// Flower bed: a low wooden frame full of leaves with red and yellow flowers.
export default model([8, 4, 8], { woodDark: '#8A5A36', leaf: '#5FA83E', leafDark: '#4A8A30', flower: '#FF5A5F', flower2: '#FFE14D' }, (m) => {
  m.paint('woodDark');
  m.box(0, 0, 0, 8, 2, 8);
  m.paint('leaf');
  m.box(1, 1, 1, 6, 2, 6);
  m.paint('leafDark');
  for (const [x, z] of [[2, 2], [5, 3], [3, 5], [6, 6]] as const) m.set(x, 2, z);
  m.paint('flower');
  for (const [x, z] of [[1, 1], [4, 2], [2, 4], [6, 4], [5, 6]] as const) m.set(x, 3, z);
  m.paint('flower2');
  for (const [x, z] of [[3, 1], [6, 2], [1, 5], [4, 5], [2, 6]] as const) m.set(x, 3, z);
});

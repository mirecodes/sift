import { model } from '../../../tools/content-build/dsl';

// Windmill: a stone tower with a pointed roof and four sails on a hub that turns (`blade` part, `spin`).
// Two tiles wide so the sails fit.
const HUB = [8, 14, 7] as const;

export default model([16, 22, 8], { stone: '#C9C2B4', stoneDark: '#9A9285', roof: '#A0522D', woodDark: '#5E3B20', cloth: '#F4F1EA', wood: '#B98552' }, (m) => {
  m.paint('stone');
  m.cylinder(8, 0, 4, 3.2, 13);
  m.paint('stoneDark');
  m.cylinder(8, 0, 4, 3.2, 1);
  m.paint('woodDark');
  m.box(7, 0, 7, 2, 3, 1); // door
  m.paint('roof');
  m.cylinder(8, 13, 4, 3.6, 2);
  m.cylinder(8, 15, 4, 2.6, 2);
  m.cylinder(8, 17, 4, 1.4, 2);
  m.part('blade', HUB, () => {
    m.paint('woodDark');
    m.set(8, 14, 7);
    m.paint('wood');
    m.box(8, 15, 7, 1, 7, 1); // up
    m.box(8, 7, 7, 1, 7, 1); // down
    m.box(1, 14, 7, 7, 1, 1); // left
    m.box(9, 14, 7, 7, 1, 1); // right
    m.paint('cloth');
    m.box(9, 17, 7, 2, 5, 1);
    m.box(6, 7, 7, 2, 5, 1);
    m.box(1, 15, 7, 5, 2, 1);
    m.box(11, 12, 7, 5, 2, 1);
  });
});

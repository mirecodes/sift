import { model } from '../../../tools/content-build/dsl';

// Champion Flag (F11, not for sale): a tall pole with a waving pennant (`flag` part, `sway`).
export default model([8, 22, 2], { metal: '#C9CCD3', stone: '#9A9DA3', cloth: '#FF5A5F', cloth2: '#FFE14D' }, (m) => {
  m.paint('stone');
  m.box(0, 0, 0, 3, 1, 2);
  m.paint('metal');
  m.box(1, 1, 0, 1, 21, 1);
  m.part('flag', [1, 20, 0], () => {
    m.paint('cloth');
    m.box(2, 15, 0, 6, 6, 1);
    m.paint('cloth2');
    m.box(4, 17, 0, 2, 2, 1);
  });
});

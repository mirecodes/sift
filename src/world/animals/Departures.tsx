import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { BoxGeometry, Group, MeshBasicMaterial, MeshLambertMaterial } from 'three';
import { palette } from '../palette';

// Departure (DESIGN.md 18): stagger and shrink are shared with the animal itself.
export const DEPART_STAGGER_S = 0.12;
export const DEPART_SHRINK_S = 0.3;
const PUFFS = 6;
const PUFF_S = 0.6;
const PUFF_SIZE = 0.09;
const PUFF_REACH = 0.35;
const COIN_DELAY_S = 0.15;
const COIN_S = 0.7;
const COIN_PEAK = 1.2;
const COIN_SIZE = 0.16;
const BURST = 8;
const BURST_S = 0.8;
const BURST_UP = 2.2;
const GRAVITY = 5;
const TAU = Math.PI * 2;

const box = new BoxGeometry(1, 1, 1);
const coinMaterial = new MeshLambertMaterial({ color: palette.coin });
const puffMaterial = new MeshBasicMaterial({ color: palette.puff });

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) ** 2;

interface Spot {
  x: number;
  z: number;
}

interface Props {
  /** Tiles of the animated departures, in order. */
  from: readonly Spot[];
  /** One combined coin burst from the pile for the departures that vanish without animation. */
  burst: boolean;
  pile: Spot;
  ground: (x: number, z: number) => number;
}

/** Puffs and coin arcs for one shown departure notice; remount (new `key`) for the next one. */
export function DepartureEffects({ from, burst, pile, ground }: Props) {
  const group = useRef<Group>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    t.current += Math.min(delta, 0.1);
    const now = t.current;
    const pileY = ground(pile.x, pile.z) + 0.15;
    const kids = g.children;
    let k = 0;
    from.forEach((p, i) => {
      const start = i * DEPART_STAGGER_S;
      const y0 = ground(p.x, p.z) + 0.15;
      const tp = (now - start) / PUFF_S;
      for (let j = 0; j < PUFFS; j++) {
        const m = kids[k++]!;
        m.visible = tp >= 0 && tp < 1;
        if (!m.visible) continue;
        const a = (j / PUFFS) * TAU + i;
        const r = PUFF_REACH * easeOut(tp);
        m.position.set(p.x + Math.cos(a) * r, y0 + 0.25 * tp, p.z + Math.sin(a) * r);
        m.scale.setScalar(PUFF_SIZE * (1 - tp));
      }
      const coin = kids[k++]!;
      const tc = (now - start - COIN_DELAY_S) / COIN_S;
      coin.visible = tc >= 0 && tc < 1;
      if (coin.visible) {
        coin.position.set(lerp(p.x, pile.x, tc), lerp(y0, pileY, tc) + 4 * COIN_PEAK * tc * (1 - tc), lerp(p.z, pile.z, tc));
        coin.rotation.y = tc * TAU * 2;
      }
    });
    if (burst) {
      for (let j = 0; j < BURST; j++) {
        const m = kids[k++]!;
        m.visible = now < BURST_S;
        if (!m.visible) continue;
        const a = (j / BURST) * TAU;
        m.position.set(pile.x + Math.cos(a) * 0.5 * now, pileY + BURST_UP * now - 0.5 * GRAVITY * now * now, pile.z + Math.sin(a) * 0.5 * now);
        m.rotation.y = now * 6;
      }
    }
  });

  return (
    <group ref={group}>
      {from.map((_, i) => [
        ...Array.from({ length: PUFFS }, (__, j) => <mesh key={`p${i}-${j}`} geometry={box} material={puffMaterial} visible={false} />),
        <mesh key={`c${i}`} geometry={box} material={coinMaterial} scale={[COIN_SIZE, COIN_SIZE * 0.4, COIN_SIZE]} visible={false} />,
      ])}
      {burst &&
        Array.from({ length: BURST }, (_, j) => (
          <mesh key={`b${j}`} geometry={box} material={coinMaterial} scale={[COIN_SIZE, COIN_SIZE * 0.4, COIN_SIZE]} visible={false} />
        ))}
    </group>
  );
}

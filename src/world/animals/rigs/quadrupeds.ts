import { AnimalRig, blip, TAU, type Motion, type RigFrame } from './AnimalRig';

/**
 * Four legs (`legFL`, `legFR`, `legBL`, `legBR`), usually a head with ears and a tail: trotting gait in
 * diagonal pairs, ear twitches, a lazy tail. Species families below add their own motions.
 */
export class QuadrupedRig extends AnimalRig {
  /** Leg swing while walking, in radians. */
  protected stepSwing = 0.6;

  protected override ambient(f: RigFrame): void {
    this.turn('tail', 0, Math.sin(f.t * 1.7 + this.phase * TAU) * 0.15, 0);
    this.turn('tail2', 0, Math.sin(f.t * 1.7 + this.phase * TAU - 0.8) * 0.2, 0);
    const twitch = blip(f.t, 4.3, this.phase);
    this.turn('earL', 0, 0, -0.35 * twitch);
    this.turn('earR', 0, 0, 0.35 * blip(f.t, 5.1, this.phase + 0.4));
  }

  protected override gait(f: RigFrame): void {
    const s = Math.sin(f.stride) * this.stepSwing * f.walk;
    this.turn('legFL', s, 0, 0);
    this.turn('legBR', s, 0, 0);
    this.turn('legFR', -s, 0, 0);
    this.turn('legBL', -s, 0, 0);
    this.turn('head', Math.sin(f.stride * 2) * 0.05 * f.walk, 0, 0);
    this.turn('tail', 0, Math.sin(f.stride) * 0.25 * f.walk, 0);
  }

  protected override hop(arc: number): void {
    this.legs(-0.5 * arc, 0.6 * arc);
    this.turn('tail', 0.3 * arc, 0, 0);
  }

  protected override sleep(lie: number, f: RigFrame): void {
    super.sleep(lie, f);
    this.legs(-0.3 * lie, 0.4 * lie);
    this.turn('tail', -0.2 * lie, 0.7 * lie, 0);
  }

  /** Front legs and hind legs by the same angles. */
  protected legs(front: number, hind: number): void {
    this.turn('legFL', front, 0, 0);
    this.turn('legFR', front, 0, 0);
    this.turn('legBL', hind, 0, 0);
    this.turn('legBR', hind, 0, 0);
  }

  /** Sitting on the haunches: front up around the hind hips, hind legs folded forward. */
  protected sitPose(w: number): void {
    const hip = this.jointOf('legBL');
    this.body(-0.5 * w, 0, 0, hip.z, 0, -1.2 * w, 0);
    this.legs(0.5 * w, -0.9 * w);
    this.turn('head', 0.4 * w, 0, 0);
    this.turn('tail', -0.4 * w, 0, 0);
  }

  protected override repertoire(): Motion[] {
    return [
      ...super.repertoire(),
      { id: 'wag', minRank: 0, needs: ['tail'], length: 1.3, play: (p, w) => this.turn('tail', 0.35 * w, Math.sin(p * TAU * 5) * 0.7 * w, 0) },
      {
        id: 'scratch',
        minRank: 1,
        needs: ['legBL', 'head'],
        length: 1.8,
        play: (p, w) => {
          this.turn('legBL', (-0.9 + Math.sin(p * TAU * 7) * 0.3) * w, 0, -0.35 * w);
          this.turn('head', 0.15 * w, -0.45 * w, 0.3 * w);
          this.turn('earL', 0, 0, -0.3 * w);
          this.body(0, 0, -0.08 * w);
        },
      },
      {
        id: 'stretch',
        minRank: 1,
        needs: ['legFL', 'legFR'],
        length: 2,
        play: (p, w) => {
          const hip = this.jointOf('legBL');
          this.body(0.28 * w, 0, 0, hip.z, hip.y);
          this.legs(-0.95 * w, -0.28 * w);
          this.turn('head', -0.25 * w, 0, 0);
          this.turn('tail', 0.6 * w, Math.sin(p * TAU * 3) * 0.4 * w, 0);
        },
      },
      { id: 'sit', minRank: 2, needs: ['legBL', 'legBR'], length: 2.4, play: (_p, w) => this.sitPose(w) },
      {
        id: 'shake',
        minRank: 2,
        needs: ['head'],
        length: 1.2,
        play: (p, w) => {
          const s = Math.sin(p * TAU * 6);
          this.body(0, 0, s * 0.22 * w, 0, 0, 0.3 * w);
          this.turn('head', 0, 0, Math.sin(p * TAU * 6 + 0.7) * 0.35 * w);
          this.turn('earL', 0, 0, -0.7 * Math.abs(s) * w);
          this.turn('earR', 0, 0, 0.7 * Math.abs(s) * w);
          this.turn('tail', 0, -s * 0.5 * w, 0);
        },
      },
    ];
  }
}

/** Dog, wolf, fox: an eager wag and, from Epic, a sitting howl. */
export class CanineRig extends QuadrupedRig {
  protected override repertoire(): Motion[] {
    return [
      ...super.repertoire(),
      {
        id: 'howl',
        minRank: 2,
        needs: ['head', 'legBL'],
        length: 2.4,
        play: (p, w) => {
          this.sitPose(w);
          this.turn('head', -1.15 * w + Math.sin(p * TAU * 2) * 0.05 * w, 0, 0);
          this.turn('earL', 0.3 * w, 0, 0);
          this.turn('earR', 0.3 * w, 0, 0);
        },
      },
    ];
  }
}

/** Cat, tiger: grooming, a crouch-and-pounce, and at Legendary a roar. */
export class FelineRig extends QuadrupedRig {
  protected override ambient(f: RigFrame): void {
    super.ambient(f);
    // A cat's tail curls slowly at the tip.
    this.turn('tail2', Math.sin(f.t * 0.9 + this.phase * TAU) * 0.3, 0, 0);
  }

  protected override repertoire(): Motion[] {
    return [
      ...super.repertoire(),
      {
        id: 'groom',
        minRank: 1,
        needs: ['legFL', 'head'],
        length: 2.2,
        play: (p, w) => {
          this.turn('legFL', -1.3 * w, 0, 0.2 * w);
          this.turn('head', (0.35 + Math.sin(p * TAU * 5) * 0.1) * w, 0.25 * w, 0);
        },
      },
      {
        id: 'pounce',
        minRank: 2,
        needs: ['legFL', 'legBL'],
        length: 1.9,
        play: (p, w) => {
          const crouch = p < 0.62 ? w : Math.max(0, 1 - (p - 0.62) / 0.12);
          const leap = p >= 0.62 && p < 0.86 ? Math.sin(((p - 0.62) / 0.24) * Math.PI) : 0;
          this.body(-0.35 * leap, 0, 0, 0, 0, -1.1 * crouch + 2.5 * leap, 2 * leap);
          this.legs(-0.4 * crouch - 0.7 * leap, 0.5 * crouch + 0.6 * leap);
          this.turn('head', -0.2 * crouch, 0, 0);
          this.turn('tail', 0, Math.sin(p * TAU * 7) * 0.45 * crouch, 0);
          this.turn('earL', 0.3 * crouch, 0, 0);
          this.turn('earR', 0.3 * crouch, 0, 0);
        },
      },
      {
        id: 'roar',
        minRank: 3,
        needs: ['head'],
        length: 2,
        play: (p, w) => {
          const hip = this.jointOf('legBL');
          this.body(-0.18 * w, 0, 0, hip.z);
          this.legs(-0.1 * w, 0.18 * w);
          this.turn('head', -0.5 * w, Math.sin(p * TAU * 6) * 0.06 * w, 0);
          this.turn('earL', 0.5 * w, 0, 0);
          this.turn('earR', 0.5 * w, 0, 0);
          this.turn('tail', 0.6 * w, 0, 0);
          this.turn('tail2', 0.5 * w, 0, 0);
        },
      },
    ];
  }
}

/** Horse, unicorn, deer, cow, goat, sheep, pig: grazing, stomping, bucking and the Legendary rear. */
export class HoofedRig extends QuadrupedRig {
  protected override stepSwing = 0.45;

  protected override repertoire(): Motion[] {
    return [
      ...super.repertoire(),
      { id: 'graze', minRank: 0, needs: ['head'], length: 2.6, play: (p, w) => this.turn('head', (0.85 + Math.sin(p * TAU * 6) * 0.07) * w, 0, 0) },
      { id: 'stomp', minRank: 1, needs: ['legFL'], length: 1.3, play: (p, w) => this.turn('legFL', -0.7 * Math.max(0, Math.sin(p * TAU * 2)) * w, 0, 0) },
      {
        id: 'buck',
        minRank: 2,
        needs: ['legBL', 'legBR'],
        length: 1.4,
        play: (p) => {
          const kick = Math.sin(p * Math.PI);
          const front = this.jointOf('legFL');
          this.body(0.3 * kick, 0, 0, front.z);
          this.legs(0.25 * kick, 0.9 * kick);
          this.turn('head', 0.3 * kick, 0, 0);
          this.turn('tail', 0.8 * kick, 0, 0);
        },
      },
      {
        id: 'rear',
        minRank: 3,
        needs: ['legFL', 'legFR'],
        length: 2.2,
        play: (p, w) => {
          const hip = this.jointOf('legBL');
          this.body(-0.75 * w, 0, 0, hip.z);
          this.legs(-0.4 * w, 0.75 * w);
          this.turn('legFL', Math.sin(p * TAU * 3) * 0.45 * w, 0, 0);
          this.turn('legFR', -Math.sin(p * TAU * 3) * 0.45 * w, 0, 0);
          this.turn('head', 0.35 * w, 0, 0);
          this.turn('tail', 0.5 * w, 0, 0);
        },
      },
    ];
  }
}

/** Bear, panda, koala, red panda: standing up on the hind legs and waving. */
export class BearRig extends QuadrupedRig {
  protected override stepSwing = 0.45;

  protected override repertoire(): Motion[] {
    return [
      ...super.repertoire(),
      {
        id: 'stand',
        minRank: 2,
        needs: ['legBL', 'legBR'],
        length: 2.6,
        play: (p, w) => {
          const hip = this.jointOf('legBL');
          this.body(-1.15 * w, 0, 0, hip.z, hip.y);
          this.legs(0.85 * w + Math.sin(p * TAU * 2) * 0.15 * w, 1.15 * w);
          this.turn('head', 1 * w, 0, Math.sin(p * TAU) * 0.15 * w);
        },
      },
      {
        id: 'wave',
        minRank: 2,
        needs: ['legFR'],
        length: 1.9,
        play: (p, w) => {
          this.turn('legFR', -1.5 * w, 0, (0.2 + Math.sin(p * TAU * 3) * 0.45) * w);
          this.turn('head', 0, 0, 0.2 * w);
          this.body(0, 0, -0.06 * w);
        },
      },
    ];
  }
}

/** Lizard, frog, axolotl: sprawled legs that swing sideways, a body that snakes, push-ups. */
export class ReptileRig extends QuadrupedRig {
  protected override gait(f: RigFrame): void {
    const s = Math.sin(f.stride) * 0.55 * f.walk;
    this.turn('legFL', 0, s, 0);
    this.turn('legBR', 0, s, 0);
    this.turn('legFR', 0, s, 0);
    this.turn('legBL', 0, s, 0);
    this.body(0, Math.sin(f.stride) * 0.12 * f.walk, 0);
    this.turn('tail', 0, -Math.sin(f.stride) * 0.4 * f.walk, 0);
  }

  protected override ambient(f: RigFrame): void {
    this.turn('tail', 0, Math.sin(f.t * 1.1 + this.phase * TAU) * 0.2, 0);
    // Axolotl gills (its "ears") ripple.
    this.turn('earL', 0, Math.sin(f.t * 3 + this.phase * TAU) * 0.2, 0);
    this.turn('earR', 0, -Math.sin(f.t * 3 + this.phase * TAU) * 0.2, 0);
  }

  protected override repertoire(): Motion[] {
    return [
      ...super.repertoire().filter((m) => m.id !== 'wag'),
      {
        id: 'pushup',
        minRank: 0,
        needs: ['legFL', 'legFR'],
        length: 1.4,
        play: (p) => {
          const up = Math.abs(Math.sin(p * TAU));
          const hip = this.jointOf('legBL');
          this.body(-0.22 * up, 0, 0, hip.z);
          this.legs(0.22 * up, 0);
        },
      },
    ];
  }
}

/** Turtle: pulls its head into the shell. */
export class TurtleRig extends ReptileRig {
  protected override repertoire(): Motion[] {
    return [
      ...super.repertoire().filter((m) => m.id !== 'pushup'),
      {
        id: 'hide',
        minRank: 0,
        needs: ['head'],
        length: 2.4,
        play: (_p, w) => {
          this.shift('head', 0, -0.3 * w, -1.6 * w);
          this.shift('legFL', 0.4 * w, 0.4 * w, -0.4 * w);
          this.shift('legFR', -0.4 * w, 0.4 * w, -0.4 * w);
        },
      },
    ];
  }
}

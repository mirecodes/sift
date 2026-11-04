import { AnimalRig, blip, TAU, type Motion, type RigFrame } from './AnimalRig';

/**
 * Two legs (`legL`, `legR`), folded wings (`wingL`, `wingR`), a head and a tail: alternating steps
 * with a waddle, pecking, wing flaps, preening. Owl, peacock and penguin add their own motions.
 */
export class BirdRig extends AnimalRig {
  /** Side-to-side roll while walking, in radians. */
  protected waddle = 0.1;

  protected override ambient(f: RigFrame): void {
    this.turn('tail', 0.25 * blip(f.t, 3.7, this.phase), 0, 0);
    if (f.excited) this.openWings(0.25 + 0.2 * Math.sin(f.t * TAU * 4));
  }

  protected override gait(f: RigFrame): void {
    const s = Math.sin(f.stride);
    this.turn('legL', s * 0.6 * f.walk, 0, 0);
    this.turn('legR', -s * 0.6 * f.walk, 0, 0);
    this.body(0, 0, s * this.waddle * f.walk);
    this.turn('head', Math.sin(f.stride * 2) * 0.12 * f.walk, 0, 0);
  }

  protected override hop(arc: number): void {
    this.openWings(0.5 * arc);
    this.turn('legL', 0.4 * arc, 0, 0);
    this.turn('legR', 0.4 * arc, 0, 0);
  }

  protected override sleep(lie: number): void {
    // Head tucked toward the back.
    this.turn('head', 0.3 * lie, 0.9 * lie, 0);
  }

  protected openWings(a: number): void {
    this.turn('wingL', 0, 0, -a);
    this.turn('wingR', 0, 0, a);
  }

  protected override repertoire(): Motion[] {
    return [
      ...super.repertoire(),
      {
        id: 'peck',
        minRank: 0,
        needs: ['head'],
        length: 1.3,
        play: (p, w) => {
          const peck = Math.max(0, Math.sin(p * TAU * 2.5));
          this.body(0.18 * w, 0, 0);
          this.turn('head', 0.75 * peck * w, 0, 0);
          this.turn('tail', 0.3 * w, 0, 0);
        },
      },
      {
        id: 'flap',
        minRank: 0,
        needs: ['wingL', 'wingR'],
        length: 1.2,
        play: (p, w) => {
          this.openWings((0.7 + Math.sin(p * TAU * 4) * 0.5) * w);
          this.body(-0.1 * w, 0, 0, 0, 0, 0.6 * Math.abs(Math.sin(p * TAU * 2)) * w);
        },
      },
      {
        id: 'preen',
        minRank: 1,
        needs: ['head', 'wingL'],
        length: 1.9,
        play: (p, w) => {
          this.turn('head', (0.45 + Math.sin(p * TAU * 5) * 0.1) * w, -1.1 * w, 0);
          this.turn('wingL', 0, 0, -0.35 * w);
        },
      },
      {
        id: 'stretchWing',
        minRank: 1,
        needs: ['wingR', 'legR'],
        length: 1.7,
        play: (_p, w) => {
          this.turn('wingR', 0.5 * w, 0, 1.0 * w);
          this.turn('legR', 0.7 * w, 0, 0.15 * w);
          this.body(0, 0, -0.08 * w);
        },
      },
    ];
  }
}

/** Owl: turns its head half way round. */
export class OwlRig extends BirdRig {
  protected override repertoire(): Motion[] {
    return [
      ...super.repertoire(),
      {
        id: 'headSpin',
        minRank: 1,
        needs: ['head'],
        length: 2.6,
        play: (p) => this.turn('head', 0, Math.sin(p * Math.PI) * 2.6, 0),
      },
    ];
  }
}

/** Peacock: raises its tail into a fan and shivers it (Epic). */
export class PeacockRig extends BirdRig {
  protected override repertoire(): Motion[] {
    return [
      ...super.repertoire(),
      {
        id: 'display',
        minRank: 2,
        needs: ['tail'],
        length: 2.8,
        play: (p, w) => {
          this.turn('tail', 1.25 * w, 0, Math.sin(p * TAU * 12) * 0.04 * w);
          this.turn('head', -0.15 * w, 0, 0);
          this.openWings(0.2 * w);
          this.body(0, Math.sin(p * TAU) * 0.5 * w, 0);
        },
      },
    ];
  }
}

/** Penguin: a strong waddle and flipper flaps. */
export class PenguinRig extends BirdRig {
  protected override waddle = 0.24;

  protected override repertoire(): Motion[] {
    return [
      ...super.repertoire().filter((m) => m.id !== 'preen'),
      {
        id: 'flipper',
        minRank: 1,
        needs: ['wingL', 'wingR'],
        length: 1.4,
        play: (p, w) => {
          this.openWings((0.5 + Math.sin(p * TAU * 6) * 0.4) * w);
          this.turn('head', -0.3 * w, 0, 0);
          this.body(0, 0, Math.sin(p * TAU * 3) * 0.1 * w);
        },
      },
    ];
  }
}

import { AnimalRig, TAU, type Motion, type RigFrame } from './AnimalRig';

/** Butterfly (`flutter`): flat wings flapping all the time (DESIGN.md 18), folded up when asleep. */
export class FlyerRig extends AnimalRig {
  protected flapHz = 3;
  protected flapMin = 0.15;
  protected flapMax = 0.85;
  /** Wing angle with reduced motion. */
  protected stillAngle = 0.3;

  protected override ambient(f: RigFrame): void {
    const hz = this.flapHz * (f.excited ? 1.5 : 1);
    const k = 0.5 + 0.5 * Math.sin(f.t * TAU * hz + this.phase * TAU);
    this.wings((this.flapMin + (this.flapMax - this.flapMin) * k) * (1 - f.lie));
  }

  protected override sleep(lie: number): void {
    // Folded up while asleep.
    this.wings(lie * 1.2);
  }

  override still(): void {
    super.still();
    this.wings(this.stillAngle);
  }

  protected wings(a: number): void {
    this.turn('wingL', 0, 0, -a);
    this.turn('wingR', 0, 0, a);
  }
}

/** Bee: a fast, small buzz of the wings (it walks, it does not fly). */
export class BeeRig extends FlyerRig {
  protected override flapHz = 9;
  protected override flapMin = 0.1;
  protected override flapMax = 0.55;
  protected override stillAngle = 0.2;

  protected override sleep(lie: number): void {
    this.wings(-lie * 0.2);
  }
}

/** Ladybug, beetle: wing cases that open and buzz now and then. */
export class BeetleRig extends AnimalRig {
  protected override repertoire(): Motion[] {
    return [
      ...super.repertoire(),
      {
        id: 'spread',
        minRank: 0,
        needs: ['wingL', 'wingR'],
        length: 1.8,
        play: (p, w) => {
          const buzz = Math.sin(p * TAU * 14) * 0.08 * w;
          this.turn('wingL', 0.15 * w, 0.35 * w, -(0.75 * w + buzz));
          this.turn('wingR', 0.15 * w, -0.35 * w, 0.75 * w + buzz);
          this.body(-0.08 * w, 0, 0);
        },
      },
    ];
  }
}

/** Fish: a tail that never stops and a quick flick; fins paddle. */
export class FishRig extends AnimalRig {
  protected override ambient(f: RigFrame): void {
    this.turn('tail', 0, Math.sin(f.t * 3 + this.phase * TAU) * 0.18 + Math.sin(f.t * TAU * 1.5) * 0.4 * f.hop, 0);
    const fin = Math.sin(f.t * 4 + this.phase * TAU) * 0.25;
    this.turn('finL', 0, fin, 0);
    this.turn('finR', 0, -fin, 0);
  }

  protected override repertoire(): Motion[] {
    return [
      ...super.repertoire(),
      { id: 'flick', minRank: 0, needs: ['tail'], length: 0.8, play: (p, w) => this.turn('tail', 0, Math.sin(p * TAU * 3) * 0.65 * w, 0) },
    ];
  }
}

/** Crab: snapping and waving claws, legs scuttling sideways. */
export class CrabRig extends AnimalRig {
  protected override gait(f: RigFrame): void {
    const s = Math.sin(f.stride * 1.5) * 0.35 * f.walk;
    this.turn('legL', 0, 0, s);
    this.turn('legR', 0, 0, s);
    this.body(0, 0, Math.sin(f.stride * 1.5) * 0.05 * f.walk);
  }

  protected override ambient(f: RigFrame): void {
    const c = Math.sin(f.t * 1.3 + this.phase * TAU) * 0.08;
    this.turn('clawL', c, 0, 0);
    this.turn('clawR', -c, 0, 0);
  }

  protected override repertoire(): Motion[] {
    return [
      ...super.repertoire(),
      {
        id: 'snap',
        minRank: 0,
        needs: ['clawL', 'clawR'],
        length: 1.3,
        play: (p, w) => {
          const snap = Math.max(0, Math.sin(p * TAU * 4)) * 0.3 * w;
          this.turn('clawL', -0.5 * w, snap, 0);
          this.turn('clawR', -0.5 * w, -snap, 0);
        },
      },
      {
        id: 'wave',
        minRank: 0,
        needs: ['clawR'],
        length: 1.7,
        play: (p, w) => {
          this.turn('clawR', -1.1 * w, 0, Math.sin(p * TAU * 3) * 0.4 * w);
          this.body(0, 0, 0.06 * w);
        },
      },
    ];
  }
}

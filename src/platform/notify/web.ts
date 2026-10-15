import type { NotifyAdapter, Sound } from './index';

interface Note {
  freq: number;
  at: number; // seconds after start
  length: number; // seconds of decay
  gain: number;
}

const MASTER_GAIN = 0.16; // moderate default volume
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.5;

const SOUNDS: Record<Sound, Note[]> = {
  focusEnd: [
    { freq: C5, at: 0, length: 1.1, gain: 1 },
    { freq: E5, at: 0.22, length: 1.1, gain: 0.9 },
    { freq: G5, at: 0.44, length: 1.0, gain: 0.8 },
  ],
  breakEnd: [
    { freq: G5 * 1.5, at: 0, length: 0.55, gain: 0.7 },
    { freq: C6 * 1.5, at: 0.16, length: 0.55, gain: 0.6 },
  ],
  'reveal:0': [{ freq: E5, at: 0, length: 0.9, gain: 0.8 }],
  'reveal:1': [
    { freq: E5, at: 0, length: 0.9, gain: 0.8 },
    { freq: G5, at: 0.18, length: 0.9, gain: 0.8 },
  ],
  'reveal:2': [
    { freq: C5, at: 0, length: 0.9, gain: 0.8 },
    { freq: E5, at: 0.16, length: 0.9, gain: 0.8 },
    { freq: G5, at: 0.32, length: 0.9, gain: 0.8 },
    { freq: C6, at: 0.48, length: 0.9, gain: 0.7 },
  ],
  'reveal:3': [
    { freq: C5, at: 0, length: 1.0, gain: 0.8 },
    { freq: E5, at: 0.14, length: 1.0, gain: 0.8 },
    { freq: G5, at: 0.28, length: 1.0, gain: 0.8 },
    { freq: C6, at: 0.42, length: 1.0, gain: 0.7 },
    { freq: E6, at: 0.56, length: 0.9, gain: 0.6 },
  ],
};

export function createWebNotify(): NotifyAdapter {
  let ctx: AudioContext | null = null;

  const context = (): AudioContext | null => {
    if (ctx) return ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  };

  return {
    unlock() {
      const c = context();
      if (c && c.state === 'suspended') void c.resume();
    },
    play(sound) {
      const c = context();
      if (!c) return;
      if (c.state === 'suspended') void c.resume();
      const start = c.currentTime + 0.02;
      for (const n of SOUNDS[sound]) {
        const osc = c.createOscillator();
        const overtone = c.createOscillator();
        const gain = c.createGain();
        osc.type = 'sine';
        overtone.type = 'sine';
        osc.frequency.value = n.freq;
        overtone.frequency.value = n.freq * 2;
        const t0 = start + n.at;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(MASTER_GAIN * n.gain, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.length);
        const overtoneGain = c.createGain();
        overtoneGain.gain.value = 0.15;
        osc.connect(gain);
        overtone.connect(overtoneGain).connect(gain);
        gain.connect(c.destination);
        osc.start(t0);
        overtone.start(t0);
        osc.stop(t0 + n.length + 0.05);
        overtone.stop(t0 + n.length + 0.05);
      }
    },
    scheduleFocusEnd() {},
    cancelScheduled() {},
  };
}

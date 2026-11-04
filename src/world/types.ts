/**
 * Which render mode the persistent canvas is in (DESIGN.md 15.3). `sequence`: a scripted scene (island
 * move, war voyage): full rate, fixed camera, clouds, no panels to avoid.
 */
export type WorldMode = 'home' | 'focus' | 'break' | 'paused' | 'sequence';

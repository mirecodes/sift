import type { TierRank } from '../domain/config';
import { balance } from '../../shared/balance/balance';

const minimumMinutes = Math.round(balance.reward.minFocusMs / 60_000);

/** Every user-visible string. Add a locale by swapping this module's content. */
export const strings = {
  appName: 'Sift',
  home: {
    cycle: (focusMin: number, breakMin: number) => `${focusMin} min focus · ${breakMin} min break`,
    start: 'Start focus',
  },
  focus: {
    eyebrow: 'Focus',
    overtime: 'Overtime',
    end: 'End focus',
    holdToStop: 'Hold to stop',
  },
  break: {
    eyebrow: 'Break',
    ready: 'Ready for the next one?',
    startNow: 'Start focus now',
    startFocus: 'Start focus',
    home: 'Home',
    noReward: `Nice work. Focus for ${minimumMinutes} minutes or more to meet a new friend.`,
    newFriend: 'A new friend',
  },
  settings: {
    title: 'Settings',
    timer: 'Timer',
    sound: 'Sound',
    focusLength: 'Focus length',
    breakLength: 'Break length',
    chimes: 'Chimes',
    minutes: 'min',
    data: 'Data',
    exportData: 'Export data',
    exportButton: 'Export',
    importData: 'Import data',
    importButton: 'Import…',
    backupSummary: (exportedAt: number, sessions: number, animals: number) =>
      `Backup from ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(exportedAt)}: ` +
      `${sessions} ${sessions === 1 ? 'session' : 'sessions'}, ${animals} ${animals === 1 ? 'animal' : 'animals'}.`,
    replaceWarning: 'This replaces all data on this device.',
    replace: 'Replace data',
    cancel: 'Cancel',
    backupInvalid: 'This file is not a Sift backup.',
    backupNewer: 'This backup is from a newer version of Sift. Update Sift and try again.',
  },
  collection: {
    title: 'Collection',
    unknown: '???',
    stats: 'Stats',
    focusTime: 'Focus time',
    sessions: 'Sessions',
    animals: 'Animals',
    count: (n: number) => `×${n}`,
    unknownAnimal: 'Not collected yet',
  },
  /** Tier names by rank (0 lowest). Renaming a tier only changes this list. */
  tiers: ['Common', 'Mythic', 'Epic', 'Legendary'] satisfies Record<TierRank, string>,
  aria: {
    collection: 'Open collection',
    settings: 'Open settings',
    close: 'Close',
    toNight: 'Switch to night mode',
    toDay: 'Switch to day mode',
    decrease: (what: string) => `Decrease ${what}`,
    increase: (what: string) => `Increase ${what}`,
    timer: 'Timer',
    revealSkip: 'Show the new friend on the island',
  },
} as const;

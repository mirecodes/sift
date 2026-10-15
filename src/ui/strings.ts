import type { TierRank } from '../domain/config';
import { balance } from '../../shared/balance/balance';

const minimumMinutes = Math.round(balance.reward.minFocusMs / 60_000);

/** Formats a `YYYY-MM-DD` calendar date (no time zone shift: the date is read as UTC). */
const dateFormat = (options: Intl.DateTimeFormatOptions, date: string) =>
  new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(Date.parse(`${date}T00:00:00Z`));

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
    /** Tab-bar pill on other tabs: "Break 03:12". */
    pill: (time: string) => `Break ${time}`,
    over: 'Break over',
  },
  tabs: {
    island: 'Island',
    stats: 'Stats',
    friends: 'Friends',
    group: 'Group',
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
  stats: {
    /** `0m`, `42m`, `1h 42m`, `2h 05m`. */
    duration: (minutes: number) => {
      const total = Math.floor(Math.max(0, minutes));
      const h = Math.floor(total / 60);
      return h === 0 ? `${total}m` : `${h}h ${String(total % 60).padStart(2, '0')}m`;
    },
    perDay: '/ day',
    dailyAverage: 'Daily average',
    total: 'Total',
    activeDays: 'Active days',
    bestDay: 'Best day',
    none: '—',
    /** `2026-10` → `October 2026`. */
    month: (month: string) => dateFormat({ month: 'long', year: 'numeric' }, `${month}-01`),
    /** `2026-10-04` → `4 Oct`. */
    shortDate: (date: string) => dateFormat({ day: 'numeric', month: 'short' }, date),
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    week: 'Week',
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    /** `5 – 11 Oct`, `28 Sep – 4 Oct`. */
    weekRange: (from: string, to: string) =>
      from.slice(5, 7) === to.slice(5, 7)
        ? `${dateFormat({ day: 'numeric' }, from)} – ${dateFormat({ day: 'numeric', month: 'short' }, to)}`
        : `${dateFormat({ day: 'numeric', month: 'short' }, from)} – ${dateFormat({ day: 'numeric', month: 'short' }, to)}`,
    weekTotal: (total: string, average: string) => `Total ${total} · ${average} / day`,
    weekday: (date: string) => dateFormat({ weekday: 'short' }, date),
    dayOfMonth: (date: string) => String(Number(date.slice(8))),
    /** Accessible name of a day button: `Wednesday 7 October: 1h 42m, 3 sessions`. */
    dayLabel: (date: string, time: string, sessions: number) =>
      `${dateFormat({ weekday: 'long', day: 'numeric', month: 'long' }, date)}: ${time}, ${sessions} ${sessions === 1 ? 'session' : 'sessions'}`,
  },
  notice: {
    ok: 'OK',
    /** "Fox left 1 gold." / "4 animals left 9 gold." */
    animalsDeparted: (count: number, gold: number, name?: string) => `${count === 1 && name ? name : `${count} animals`} left ${gold} gold.`,
    /** Kinds whose copy arrives with their phase. */
    generic: 'Something happened while you were away.',
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
    tabs: 'Main',
    backToBreak: 'Back to the break on Island',
  },
} as const;

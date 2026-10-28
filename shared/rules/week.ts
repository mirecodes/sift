/**
 * Ranking weeks (guidance_v2 Steps 8.3, 8.5, 8.6): Monday 00:00 to Monday 00:00 in the group's time zone.
 * Weeks are named by their local start date `YYYY-MM-DD`. Uses only the standard `Intl` API.
 */
const DAY = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function parts(ms: number, timeZone: string): { y: number; m: number; d: number; h: number; min: number; s: number } {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    formatters.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(ms).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, min: Number(p.minute), s: Number(p.second) };
}

/** True for an IANA zone the runtime knows (`Asia/Seoul`). */
export function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The local week start date (Monday) of the instant `ms`. */
export function weekOf(ms: number, timeZone: string): string {
  const p = parts(ms, timeZone);
  const local = Date.UTC(p.y, p.m - 1, p.d);
  const dow = new Date(local).getUTCDay(); // 0 = Sunday
  return iso(local - ((dow + 6) % 7) * DAY);
}

/** UTC instant of local midnight at the start of `date` (handles DST: the offset is solved twice). */
export function localMidnight(date: string, timeZone: string): number {
  const wall = Date.parse(`${date}T00:00:00Z`);
  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const p = parts(guess, timeZone);
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    guess += wall - shown;
  }
  return guess;
}

/** [start, end) of the week starting `week` (a Monday date), as UTC instants. */
export function weekRange(week: string, timeZone: string): { start: number; end: number } {
  const next = iso(Date.parse(`${week}T00:00:00Z`) + 7 * DAY);
  return { start: localMidnight(week, timeZone), end: localMidnight(next, timeZone) };
}

/** The week after `week`. */
export const nextWeek = (week: string): string => iso(Date.parse(`${week}T00:00:00Z`) + 7 * DAY);
export const previousWeek = (week: string): string => iso(Date.parse(`${week}T00:00:00Z`) - 7 * DAY);

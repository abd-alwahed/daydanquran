import { TOTAL_PAGES } from "./constants";
import type { IsoDate, ScheduledPage } from "./types";

export const TOTAL_JUZ = 30;

export interface JuzProgress {
  juz: number;
  read: number;
  total: number;
}

/**
 * The juz a page counts toward on the khatma bars. `juzStarts[j - 1]` is the first page of juz j,
 * taken from the content data; a page shared by two juz counts toward the later one.
 */
export function juzOfPage(page: number, juzStarts: readonly number[]): number {
  let juz = 1;
  for (let j = 1; j < juzStarts.length; j++) if (page >= juzStarts[j]!) juz = j + 1;
  return juz;
}

/** One entry per juz: how many of its pages the reader has read. */
export function khatmaByJuz(pagesRead: Iterable<number>, juzStarts: readonly number[]): JuzProgress[] {
  const progress = juzStarts.map((start, i) => ({
    juz: i + 1,
    read: 0,
    total: (juzStarts[i + 1] ?? TOTAL_PAGES + 1) - start,
  }));
  for (const page of pagesRead) progress[juzOfPage(page, juzStarts) - 1]!.read += 1;
  return progress;
}

/** Adds `days` to a calendar date. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The seven days ending today, oldest first, each marked read or not. */
export function weekDays(log: Readonly<Record<IsoDate, number>>, today: IsoDate): { date: IsoDate; read: boolean }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return { date, read: date in log };
  });
}

/**
 * Days in a row with the day's page read, ending today (or yesterday while today is still open).
 * Shown only as encouragement after reading; never as something lost.
 */
export function consecutiveDays(log: Readonly<Record<IsoDate, number>>, today: IsoDate): number {
  let day = today in log ? today : addDays(today, -1);
  let count = 0;
  while (day in log) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

/**
 * Pages already scheduled before today that the reader has not read, ascending, limited to `available`.
 * Before the first wraparound that is pages 1 … today−1; after it, every page except today's.
 */
export function pagesToMakeUp(
  scheduled: ScheduledPage | null,
  pagesRead: ReadonlySet<number>,
  available: Iterable<number>,
): number[] {
  if (!scheduled) return [];
  const passed = (page: number) => (scheduled.khatma > 1 ? page !== scheduled.page : page < scheduled.page);
  return [...new Set(available)].filter((p) => passed(p) && !pagesRead.has(p)).sort((a, b) => a - b);
}


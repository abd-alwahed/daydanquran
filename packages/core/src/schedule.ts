import { PUBLIC_TIME_ZONE, TOTAL_PAGES } from "./constants";
import type { IsoDate, ScheduledPage } from "./types";

const MS_PER_DAY = 86_400_000;

/** The calendar date of `instant` in `timeZone`, as "YYYY-MM-DD". */
export function localDate(instant: Date, timeZone: string = PUBLIC_TIME_ZONE): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    instant,
  );
}

/** Whole days from `from` to `to`. Pure calendar arithmetic, so DST cannot skew it. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const toUtc = (date: IsoDate) => {
    const [y, m, d] = date.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY);
}

/**
 * The page everyone reads on the day containing `instant`.
 * Launch day is page 1; after page 604 a new khatma starts at page 1.
 * @throws if `instant` falls before `launchDate`.
 */
export function pageForDate(
  launchDate: IsoDate,
  instant: Date,
  timeZone: string = PUBLIC_TIME_ZONE,
): ScheduledPage {
  const days = daysBetween(launchDate, localDate(instant, timeZone));
  if (days < 0) throw new RangeError(`${localDate(instant, timeZone)} is before launch day ${launchDate}`);
  return {
    page: (days % TOTAL_PAGES) + 1,
    khatma: Math.floor(days / TOTAL_PAGES) + 1,
    dayNumber: days + 1,
  };
}

/** Like `pageForDate`, but returns null before launch instead of throwing. */
export function todaysPage(launchDate: IsoDate, instant: Date, timeZone?: string): ScheduledPage | null {
  return daysBetween(launchDate, localDate(instant, timeZone)) < 0 ? null : pageForDate(launchDate, instant, timeZone);
}

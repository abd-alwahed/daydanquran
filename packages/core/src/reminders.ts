import { CalculationMethod, Coordinates, HighLatitudeRule, PrayerTimes } from "adhan";
import type { City } from "./cities";
import { daysBetween, localDate } from "./schedule";
import type { IsoDate } from "./types";

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type Prayer = (typeof PRAYERS)[number];

export const PRAYER_NAMES: Record<Prayer, string> = {
  fajr: "الفجر",
  dhuhr: "الظهر",
  asr: "العصر",
  maghrib: "المغرب",
  isha: "العشاء",
};

/** Minutes after the adhan, so the reminder arrives once the prayer is done. */
export const AFTER_PRAYER_MINUTES = 20;
/** The one evening nudge, local time (21:00). */
export const EVENING_NUDGE_MINUTES = 21 * 60;
/** The nudge is skipped when the main reminder is less than this before it. */
const NUDGE_GAP_MINUTES = 60;
/**
 * A reminder is still sent this long after its time, so a cron run that fails or is skipped is
 * caught up by the next one, but a morning reminder never arrives at night.
 */
export const SEND_WINDOW_MINUTES = 180;
/** Days without reading after which reminders become weekly. */
export const WEEKLY_AFTER_DAYS = 7;
/** Days without reading after which reminders stop (except the Ramadan message). */
export const STOP_AFTER_DAYS = 30;

export type ReminderTime = { kind: "fixed"; minutes: number } | { kind: "prayer"; prayer: Prayer };

export interface ReminderSettings {
  city: City;
  time: ReminderTime;
  eveningNudge: boolean;
  ramadanMessage: boolean;
}

export type ReminderKind = "daily" | "weekly" | "evening" | "ramadan";

export interface ReminderHistory {
  /** Local date the reminder was set up or last changed. Quiet days are counted from here at most. */
  since: IsoDate;
  /** Latest local date with a reading, if any. */
  lastRead: IsoDate | null;
  /** Latest local date a weekly reminder was sent, if any. */
  lastWeekly: IsoDate | null;
  /** Reminders already sent, as "YYYY-MM-DD kind". Only recent days matter. */
  sent: ReadonlySet<string>;
}

export interface DueReminder {
  kind: ReminderKind;
  /** The reader's local date, the key that makes each reminder go out once. */
  localDate: IsoDate;
  /** Set when the main reminder follows a prayer. */
  prayer?: Prayer;
}

export const sentKey = (date: IsoDate, kind: ReminderKind) => `${date} ${kind}`;

/** Minutes since local midnight of `instant` in `timeZone`. */
export function minutesOfDay(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(instant);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return part("hour") * 60 + part("minute");
}

/** The adhan time of `prayer` in `city` on its local `date`, as minutes since local midnight. */
export function prayerMinutes(city: City, prayer: Prayer, date: IsoDate): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const coordinates = new Coordinates(city.latitude, city.longitude);
  const params = CalculationMethod[city.method]();
  params.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
  // adhan reads the calendar day from the Date's local fields, whatever the machine's time zone.
  const times = new PrayerTimes(coordinates, new Date(y, m - 1, d), params);
  return minutesOfDay(times[prayer], city.timeZone);
}

/** When the main reminder is due on `date`, in local minutes. */
export function reminderMinutes(settings: ReminderSettings, date: IsoDate): number {
  const { time } = settings;
  if (time.kind === "fixed") return time.minutes;
  return Math.min(prayerMinutes(settings.city, time.prayer, date) + AFTER_PRAYER_MINUTES, 24 * 60 - 1);
}

/** True on 1 Ramadan (Umm al-Qura calendar) of a local date. */
export function isRamadanStart(date: IsoDate): boolean {
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(`${date}T12:00:00Z`));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return part("month") === 9 && part("day") === 1;
}

/**
 * The reminder to send to one reader now, or null. Rules:
 * - nothing once the reader has read today;
 * - the main reminder at its time while the reader read within the last 7 days, plus one
 *   evening nudge at 21:00 if enabled and the main reminder is at least an hour earlier;
 * - after 7 quiet days, the main reminder once a week only; after 30 quiet days, none;
 * - on 1 Ramadan, if enabled, one Ramadan message at the main time replaces that day's reminder,
 *   however long the reader has been away.
 * Each (local date, kind) is sent at most once; the caller records it and re-checks the
 * reading status at send time.
 */
export function dueReminder(settings: ReminderSettings, history: ReminderHistory, now: Date): DueReminder | null {
  const { timeZone } = settings.city;
  const today = localDate(now, timeZone);
  if (history.lastRead === today) return null;

  const minutesNow = minutesOfDay(now, timeZone);
  const isDue = (at: number) => minutesNow >= at && minutesNow < at + SEND_WINDOW_MINUTES;
  const wasSent = (kind: ReminderKind) => history.sent.has(sentKey(today, kind));
  const main = reminderMinutes(settings, today);
  const prayer = settings.time.kind === "prayer" ? { prayer: settings.time.prayer } : {};

  const ramadanToday = settings.ramadanMessage && isRamadanStart(today);
  if (ramadanToday && isDue(main) && !wasSent("ramadan")) return { kind: "ramadan", localDate: today };

  const lastActive = history.lastRead !== null && history.lastRead > history.since ? history.lastRead : history.since;
  const quietDays = daysBetween(lastActive, today);
  if (quietDays >= STOP_AFTER_DAYS) return null;

  if (quietDays >= WEEKLY_AFTER_DAYS) {
    const weekPassed = history.lastWeekly === null || daysBetween(history.lastWeekly, today) >= 7;
    return !ramadanToday && weekPassed && isDue(main) && !wasSent("weekly")
      ? { kind: "weekly", localDate: today, ...prayer }
      : null;
  }

  if (!ramadanToday && isDue(main) && !wasSent("daily")) return { kind: "daily", localDate: today, ...prayer };

  const nudgeAllowed = settings.eveningNudge && main + NUDGE_GAP_MINUTES <= EVENING_NUDGE_MINUTES;
  if (nudgeAllowed && isDue(EVENING_NUDGE_MINUTES) && !wasSent("evening")) return { kind: "evening", localDate: today };

  return null;
}

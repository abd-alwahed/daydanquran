import { describe, expect, it } from "vitest";
import { CITIES, findCity } from "./cities";
import {
  dueReminder,
  isRamadanStart,
  prayerMinutes,
  reminderMinutes,
  sentKey,
  type ReminderHistory,
  type ReminderKind,
  type ReminderSettings,
} from "./reminders";

const RIYADH = findCity("riyadh")!;
const NEW_YORK = findCity("newyork")!;

const settings = (overrides: Partial<ReminderSettings> = {}): ReminderSettings => ({
  city: RIYADH,
  time: { kind: "fixed", minutes: 7 * 60 + 30 },
  eveningNudge: true,
  ramadanMessage: true,
  ...overrides,
});

const history = (overrides: Partial<ReminderHistory> = {}): ReminderHistory => ({
  since: "2026-10-23",
  lastRead: null,
  lastWeekly: null,
  sent: new Set(),
  ...overrides,
});

const sent = (...entries: [string, ReminderKind][]) => new Set(entries.map(([date, kind]) => sentKey(date, kind)));

/** The fake clock: an instant given as UTC. Riyadh is UTC+3 all year. */
const at = (iso: string) => new Date(`${iso}Z`);

describe("dueReminder: the daily reminder", () => {
  it("is due from its local time for the length of the send window, and not before", () => {
    expect(dueReminder(settings(), history(), at("2026-10-24T04:29:00"))).toBeNull(); // 07:29 Riyadh
    expect(dueReminder(settings(), history(), at("2026-10-24T04:30:00"))).toEqual({ kind: "daily", localDate: "2026-10-24" });
    expect(dueReminder(settings(), history(), at("2026-10-24T07:29:00"))?.kind).toBe("daily"); // 10:29
    expect(dueReminder(settings(), history(), at("2026-10-24T07:30:00"))).toBeNull(); // window over
  });

  it("goes out once per local date", () => {
    const h = history({ sent: sent(["2026-10-24", "daily"]) });
    expect(dueReminder(settings({ eveningNudge: false }), h, at("2026-10-24T04:45:00"))).toBeNull();
    expect(dueReminder(settings(), h, at("2026-10-25T04:30:00"))?.kind).toBe("daily");
  });

  it("is never sent once the reader has read today", () => {
    const h = history({ lastRead: "2026-10-24" });
    expect(dueReminder(settings(), h, at("2026-10-24T04:30:00"))).toBeNull();
    expect(dueReminder(settings(), h, at("2026-10-24T18:00:00"))).toBeNull(); // 21:00, no nudge either
  });

  it("follows the reader's own clock and date, across a DST change", () => {
    const ny = settings({ city: NEW_YORK });
    const h = history({ since: "2026-10-30" });
    // 07:30 in New York is 11:30 UTC under EDT (UTC-4) ...
    expect(dueReminder(ny, h, at("2026-10-31T11:30:00"))).toEqual({ kind: "daily", localDate: "2026-10-31" });
    // ... and 12:30 UTC once EST (UTC-5) starts on 1 November.
    expect(dueReminder(ny, h, at("2026-11-01T11:30:00"))).toBeNull();
    expect(dueReminder(ny, h, at("2026-11-01T12:30:00"))?.localDate).toBe("2026-11-01");
  });
});

describe("dueReminder: after a prayer", () => {
  const asr = settings({ time: { kind: "prayer", prayer: "asr" } });

  it("computes the prayer time for the city and date", () => {
    // Asr in Riyadh in late October is just before 15:00.
    const minutes = prayerMinutes(RIYADH, "asr", "2026-10-24");
    expect(minutes).toBeGreaterThan(14 * 60 + 40);
    expect(minutes).toBeLessThan(15 * 60 + 10);
    expect(reminderMinutes(asr, "2026-10-24")).toBe(minutes + 20);
    // Fajr is earlier in summer than in winter.
    expect(prayerMinutes(RIYADH, "fajr", "2027-06-21")).toBeLessThan(prayerMinutes(RIYADH, "fajr", "2026-12-21"));
  });

  it("is due twenty minutes after the adhan and names the prayer", () => {
    const due = reminderMinutes(asr, "2026-10-24");
    const utc = (minutes: number) =>
      new Date(Date.UTC(2026, 9, 24, 0, minutes - 3 * 60)); // Riyadh local minutes → UTC instant
    expect(dueReminder(asr, history(), utc(due - 1))).toBeNull();
    expect(dueReminder(asr, history(), utc(due))).toEqual({ kind: "daily", localDate: "2026-10-24", prayer: "asr" });
  });
});

describe("dueReminder: the evening nudge", () => {
  const nine = at("2026-10-24T18:00:00"); // 21:00 Riyadh
  const daySent = history({ sent: sent(["2026-10-24", "daily"]) });

  it("is sent once at 21:00 to a reader who has not read yet", () => {
    expect(dueReminder(settings(), daySent, at("2026-10-24T17:59:00"))).toBeNull();
    expect(dueReminder(settings(), daySent, nine)).toEqual({ kind: "evening", localDate: "2026-10-24" });
    const both = history({ sent: sent(["2026-10-24", "daily"], ["2026-10-24", "evening"]) });
    expect(dueReminder(settings(), both, at("2026-10-24T19:00:00"))).toBeNull();
  });

  it("respects the reader's choice and is skipped when the main reminder is too close", () => {
    expect(dueReminder(settings({ eveningNudge: false }), daySent, nine)).toBeNull();
    const late = settings({ time: { kind: "fixed", minutes: 20 * 60 + 30 } });
    expect(dueReminder(late, history({ sent: sent(["2026-10-24", "daily"]) }), nine)).toBeNull();
  });
});

describe("dueReminder: after days without reading", () => {
  const morning = (date: string) => at(`${date}T04:30:00`);

  it("stays daily for six quiet days, then turns weekly on the seventh", () => {
    const h = history({ lastRead: "2026-10-24" });
    expect(dueReminder(settings(), h, morning("2026-10-30"))?.kind).toBe("daily"); // 6 days
    expect(dueReminder(settings(), h, morning("2026-10-31"))?.kind).toBe("weekly"); // 7 days
  });

  it("sends the weekly reminder once a week, and no evening nudge", () => {
    const h = history({ lastRead: "2026-10-24", lastWeekly: "2026-10-31" });
    expect(dueReminder(settings(), h, morning("2026-11-06"))).toBeNull();
    expect(dueReminder(settings(), h, at("2026-11-04T18:00:00"))).toBeNull();
    expect(dueReminder(settings(), h, morning("2026-11-07"))?.kind).toBe("weekly");
  });

  it("stops after thirty quiet days", () => {
    const h = history({ lastRead: "2026-10-24", lastWeekly: "2026-11-14" });
    expect(dueReminder(settings(), h, morning("2026-11-21"))?.kind).toBe("weekly"); // 28 days
    expect(dueReminder(settings(), h, morning("2026-11-23"))).toBeNull(); // 30 days
    expect(dueReminder(settings(), h, morning("2027-01-15"))).toBeNull();
  });

  it("counts quiet days from the setup date for a reader who never read", () => {
    const h = history({ since: "2026-11-20" });
    expect(dueReminder(settings(), h, morning("2026-11-21"))?.kind).toBe("daily");
    expect(dueReminder(settings(), h, morning("2026-11-27"))?.kind).toBe("weekly");
  });

  it("returns to daily as soon as the reader reads again", () => {
    const h = history({ lastRead: "2026-12-01", lastWeekly: "2026-11-28" });
    expect(dueReminder(settings(), h, morning("2026-12-02"))?.kind).toBe("daily");
  });
});

describe("dueReminder: the start of Ramadan", () => {
  // 1 Ramadan 1448 is 8 February 2027 in the Umm al-Qura calendar.
  const firstOfRamadan = at("2027-02-08T04:30:00");
  const longGone = history({ lastRead: "2026-11-01" });

  it("knows the first day of Ramadan", () => {
    expect(isRamadanStart("2027-02-08")).toBe(true);
    expect(isRamadanStart("2027-02-07")).toBe(false);
    expect(isRamadanStart("2027-02-09")).toBe(false);
  });

  it("sends one Ramadan message even after reminders have stopped", () => {
    expect(dueReminder(settings(), longGone, firstOfRamadan)).toEqual({ kind: "ramadan", localDate: "2027-02-08" });
    const done = history({ lastRead: "2026-11-01", sent: sent(["2027-02-08", "ramadan"]) });
    expect(dueReminder(settings(), done, at("2027-02-08T05:00:00"))).toBeNull();
    expect(dueReminder(settings(), done, at("2027-02-09T04:30:00"))).toBeNull();
  });

  it("replaces that day's daily reminder for active readers", () => {
    const active = history({ lastRead: "2027-02-07", sent: sent(["2027-02-08", "ramadan"]) });
    expect(dueReminder(settings(), active, at("2027-02-08T05:00:00"))).toBeNull();
  });

  it("is not sent when the reader turned it off", () => {
    expect(dueReminder(settings({ ramadanMessage: false }), longGone, firstOfRamadan)).toBeNull();
    const active = history({ lastRead: "2027-02-07" });
    expect(dueReminder(settings({ ramadanMessage: false }), active, firstOfRamadan)?.kind).toBe("daily");
  });
});

describe("cities", () => {
  it("have valid time zones and calculation methods", () => {
    for (const city of CITIES) {
      expect(() => new Intl.DateTimeFormat("en", { timeZone: city.timeZone })).not.toThrow();
      expect(prayerMinutes(city, "isha", "2027-06-21")).toBeGreaterThan(prayerMinutes(city, "maghrib", "2027-06-21"));
    }
  });
});

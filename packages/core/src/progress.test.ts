import { describe, expect, it } from "vitest";
import { TOTAL_PAGES } from "./constants";
import { addDays, consecutiveDays, juzOfPage, khatmaByJuz, pagesToMakeUp, TOTAL_JUZ, weekDays } from "./progress";

// Madinah Mushaf juz start pages, as derived from content/build by scripts/sync-content.ts.
const JUZ_STARTS = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482,
  502, 522, 542, 562, 582,
];

describe("juzOfPage", () => {
  it("maps juz boundaries", () => {
    expect(juzOfPage(1, JUZ_STARTS)).toBe(1);
    expect(juzOfPage(21, JUZ_STARTS)).toBe(1);
    expect(juzOfPage(22, JUZ_STARTS)).toBe(2);
    expect(juzOfPage(581, JUZ_STARTS)).toBe(29);
    expect(juzOfPage(604, JUZ_STARTS)).toBe(30);
  });
});

describe("khatmaByJuz", () => {
  it("has 30 juz covering all 604 pages", () => {
    const progress = khatmaByJuz([], JUZ_STARTS);
    expect(progress).toHaveLength(TOTAL_JUZ);
    expect(progress.reduce((sum, j) => sum + j.total, 0)).toBe(TOTAL_PAGES);
    expect(progress[29]).toEqual({ juz: 30, read: 0, total: 23 });
  });

  it("counts read pages per juz", () => {
    const progress = khatmaByJuz([1, 2, 21, 22, 604], JUZ_STARTS);
    expect(progress[0]!.read).toBe(3);
    expect(progress[1]!.read).toBe(1);
    expect(progress[29]!.read).toBe(1);
  });
});

describe("addDays", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("weekDays", () => {
  it("returns the seven days ending today, oldest first", () => {
    const week = weekDays({ "2026-10-25": 3, "2026-10-29": 7 }, "2026-10-29");
    expect(week.map((d) => d.date)).toEqual([
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
    ]);
    expect(week.filter((d) => d.read).map((d) => d.date)).toEqual(["2026-10-25", "2026-10-29"]);
  });
});

describe("consecutiveDays", () => {
  const log = { "2026-10-23": 1, "2026-10-24": 2, "2026-10-26": 4, "2026-10-27": 5 };

  it("counts back from today", () => {
    expect(consecutiveDays(log, "2026-10-27")).toBe(2);
  });

  it("keeps yesterday's run while today is still open", () => {
    expect(consecutiveDays(log, "2026-10-28")).toBe(2);
  });

  it("is zero after a gap", () => {
    expect(consecutiveDays(log, "2026-10-30")).toBe(0);
  });
});

describe("pagesToMakeUp", () => {
  const all = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

  it("is empty before launch and on launch day", () => {
    expect(pagesToMakeUp(null, new Set(), all)).toEqual([]);
    expect(pagesToMakeUp({ page: 1, khatma: 1, dayNumber: 1 }, new Set(), all)).toEqual([]);
  });

  it("lists earlier unread pages, never today's or future ones", () => {
    expect(pagesToMakeUp({ page: 6, khatma: 1, dayNumber: 6 }, new Set([1, 3]), all)).toEqual([2, 4, 5]);
  });

  it("only lists pages that are on the site", () => {
    expect(pagesToMakeUp({ page: 6, khatma: 1, dayNumber: 6 }, new Set(), [1, 2, 3, 10])).toEqual([1, 2, 3]);
  });

  it("covers the whole Mushaf after the first khatma, except today", () => {
    const list = pagesToMakeUp({ page: 2, khatma: 2, dayNumber: 606 }, new Set([1]), all);
    expect(list).toHaveLength(TOTAL_PAGES - 2);
    expect(list).not.toContain(2);
  });
});

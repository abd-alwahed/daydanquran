import { describe, expect, it } from "vitest";
import { TOTAL_PAGES } from "./constants";
import { pageForDate, todaysPage } from "./schedule";

const LAUNCH = "2026-10-23";
const meccaNoon = (dayNumber: number) => new Date(Date.parse("2026-10-23T12:00:00+03:00") + (dayNumber - 1) * 86_400_000);

describe("pageForDate", () => {
  it("returns page 1 on launch day", () => {
    expect(pageForDate(LAUNCH, meccaNoon(1))).toEqual({ page: 1, khatma: 1, dayNumber: 1 });
  });

  it("switches page at midnight Mecca time, not UTC", () => {
    expect(pageForDate(LAUNCH, new Date("2026-10-23T20:59:59Z")).page).toBe(1);
    expect(pageForDate(LAUNCH, new Date("2026-10-23T21:00:00Z")).page).toBe(2);
  });

  it("wraps after page 604 into a new khatma", () => {
    expect(pageForDate(LAUNCH, meccaNoon(604))).toEqual({ page: 604, khatma: 1, dayNumber: 604 });
    expect(pageForDate(LAUNCH, meccaNoon(605))).toEqual({ page: 1, khatma: 2, dayNumber: 605 });
  });

  it("hits every page exactly once per khatma", () => {
    const pages = new Set(Array.from({ length: TOTAL_PAGES }, (_, i) => pageForDate(LAUNCH, meccaNoon(i + 1)).page));
    expect(pages.size).toBe(TOTAL_PAGES);
  });

  it("throws before launch day", () => {
    expect(() => pageForDate(LAUNCH, meccaNoon(0))).toThrow(RangeError);
  });
});

describe("todaysPage", () => {
  it("returns null before launch instead of throwing", () => {
    expect(todaysPage(LAUNCH, meccaNoon(0))).toBeNull();
    expect(todaysPage(LAUNCH, meccaNoon(3))?.page).toBe(3);
  });
});

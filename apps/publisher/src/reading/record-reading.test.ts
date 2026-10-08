import { describe, expect, it } from "vitest";
import { LAUNCH_DATE, TOTAL_PAGES } from "@daydan/core";
import { MemoryReadingStore } from "./memory-store";
import { readingReply } from "./messages";
import { recordReading } from "./record-reading";

const LAUNCH_NOON = new Date(`${LAUNCH_DATE}T09:00:00Z`); // 12:00 in Mecca: page 1

describe("recordReading", () => {
  it("logs today's page once per day, however many times it is pressed", async () => {
    const store = new MemoryReadingStore();
    await recordReading(store, "42", 1, LAUNCH_NOON);
    const again = await recordReading(store, "42", 1, LAUNCH_NOON);
    expect(store.dailyLog.size).toBe(1);
    expect(again.pagesInKhatma).toBe(1);
  });

  it("counts an earlier day's page toward the khatma without filling today's log", async () => {
    const store = new MemoryReadingStore();
    const { pagesInKhatma } = await recordReading(store, "42", 300, LAUNCH_NOON);
    expect(store.dailyLog.size).toBe(0);
    expect(pagesInKhatma).toBe(1);
  });

  it("keeps each reader's progress separate", async () => {
    const store = new MemoryReadingStore();
    await recordReading(store, "1", 1, LAUNCH_NOON);
    await recordReading(store, "1", 2, LAUNCH_NOON);
    expect((await recordReading(store, "2", 1, LAUNCH_NOON)).pagesInKhatma).toBe(1);
  });

  it("completes the khatma on the 604th distinct page and starts the next one", async () => {
    const store = new MemoryReadingStore();
    for (let page = 1; page < TOTAL_PAGES; page++) await recordReading(store, "42", page, LAUNCH_NOON);
    const last = await recordReading(store, "42", TOTAL_PAGES, LAUNCH_NOON);
    expect(last).toEqual({ pagesInKhatma: TOTAL_PAGES, completedKhatma: true });
    expect((await recordReading(store, "42", 1, LAUNCH_NOON)).pagesInKhatma).toBe(1);
  });
});

describe("readingReply", () => {
  it("uses the message library wording with Arabic-Indic digits", () => {
    expect(readingReply({ pagesInKhatma: 12, completedKhatma: false })).toBe("تقبّل الله ✅ ختمتك: ١٢ من ٦٠٤ صفحة");
    expect(readingReply({ pagesInKhatma: 604, completedKhatma: true })).toContain("ختمت القرآن مع دَيْدَن");
  });
});

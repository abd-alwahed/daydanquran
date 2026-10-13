import { LAUNCH_DATE, TOTAL_PAGES, localDate, todaysPage } from "@daydan/core";
import type { ReadingStore } from "./store";

export interface ReadingOutcome {
  /** Pages read in the khatma this page belongs to. */
  pagesInKhatma: number;
  /** True when this page completed all 604 pages. */
  completedKhatma: boolean;
}

/**
 * Handles "قرأت" for a page.
 * Today's shared page (page 1 before launch) also fills the reader's daily log (once per local date);
 * any page, including one from an earlier day, counts toward the personal khatma.
 */
export async function recordReading(
  store: ReadingStore,
  telegramUserId: string,
  page: number,
  now: Date,
): Promise<ReadingOutcome> {
  const reader = await store.findOrCreateReader("telegram", telegramUserId);

  // Before launch the only posts are dry-run rehearsals of day one, so page 1 stands in for today.
  if ((todaysPage(LAUNCH_DATE, now)?.page ?? 1) === page) {
    await store.logDailyReading(reader.id, localDate(now, reader.timezone), page, "telegram");
  }

  const pagesInKhatma = await store.addPageToKhatma(reader.id, reader.currentKhatma, page);
  const completedKhatma = pagesInKhatma === TOTAL_PAGES;
  if (completedKhatma) await store.startNextKhatma(reader.id);
  return { pagesInKhatma, completedKhatma };
}

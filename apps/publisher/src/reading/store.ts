import type { IsoDate } from "@daydan/core";

export interface Reader {
  id: number;
  timezone: string;
  currentKhatma: number;
}

/** Storage for reading progress. D1 today; another backend can implement the same contract. */
export interface ReadingStore {
  /** Returns the reader behind a platform identity, creating both on first sight. */
  findOrCreateReader(provider: "telegram", providerUserId: string): Promise<Reader>;
  /** Records the day's reading. Returns false when that local date already has one (counts once). */
  logDailyReading(readerId: number, localDate: IsoDate, page: number, source: "telegram"): Promise<boolean>;
  /** Adds the page to the khatma (no-op if already there) and returns how many pages it now has. */
  addPageToKhatma(readerId: number, khatma: number, page: number): Promise<number>;
  startNextKhatma(readerId: number): Promise<void>;
}

import type { IsoDate } from "@daydan/core";

/** What the reader has done, as seen by the UI. */
export interface ReadingState {
  /** Distinct Mushaf pages read in the current personal khatma. */
  pagesRead: ReadonlySet<number>;
  /** One entry per local date: the page marked as that day's reading. */
  log: Readonly<Record<IsoDate, number>>;
}

/**
 * Where reading progress lives. The browser implementation is the only one today;
 * a Supabase-backed one can replace it without touching components.
 */
export interface ReadingRepository {
  getSnapshot(): ReadingState;
  /** Server render has no progress. */
  getServerSnapshot(): ReadingState;
  subscribe(onChange: () => void): () => void;
  /**
   * Marks `page` as read. When it is the day's scheduled page it also fills the day's log entry,
   * which is unique per local date, so marking twice counts once.
   */
  markRead(page: number, options: { localDate: IsoDate; isTodaysPage: boolean }): void;
}

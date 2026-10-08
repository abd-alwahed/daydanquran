import type { Reader, ReadingStore } from "./store";

/** In-memory ReadingStore with the same uniqueness rules as the D1 schema. For tests. */
export class MemoryReadingStore implements ReadingStore {
  readonly readers: Reader[] = [];
  readonly identities = new Map<string, number>();
  readonly dailyLog = new Map<string, number>();
  readonly pages = new Map<string, Set<number>>();

  async findOrCreateReader(provider: "telegram", providerUserId: string): Promise<Reader> {
    const key = `${provider}:${providerUserId}`;
    let id = this.identities.get(key);
    if (id === undefined) {
      id = this.readers.length + 1;
      this.readers.push({ id, timezone: "Asia/Riyadh", currentKhatma: 1 });
      this.identities.set(key, id);
    }
    return { ...this.readers[id - 1]! };
  }

  async logDailyReading(readerId: number, localDate: string, page: number): Promise<boolean> {
    const key = `${readerId}:${localDate}`;
    if (this.dailyLog.has(key)) return false;
    this.dailyLog.set(key, page);
    return true;
  }

  async addPageToKhatma(readerId: number, khatma: number, page: number): Promise<number> {
    const key = `${readerId}:${khatma}`;
    const pages = this.pages.get(key) ?? new Set<number>();
    pages.add(page);
    this.pages.set(key, pages);
    return pages.size;
  }

  async startNextKhatma(readerId: number): Promise<void> {
    this.readers[readerId - 1]!.currentKhatma += 1;
  }
}

import type { Reader, ReadingStore } from "./store";

interface ReaderRow {
  id: number;
  timezone: string;
  current_khatma: number;
}

const toReader = (row: ReaderRow): Reader => ({ id: row.id, timezone: row.timezone, currentKhatma: row.current_khatma });

export class D1ReadingStore implements ReadingStore {
  constructor(private readonly db: D1Database) {}

  async findOrCreateReader(provider: "telegram", providerUserId: string): Promise<Reader> {
    const existing = await this.findReader(provider, providerUserId);
    if (existing) return existing;

    const created = await this.db.prepare("INSERT INTO users DEFAULT VALUES RETURNING id").first<{ id: number }>();
    if (!created) throw new Error("Could not create user");
    // Two first presses at once may race: the identity's primary key keeps exactly one,
    // and the losing user row is removed.
    await this.db
      .prepare("INSERT OR IGNORE INTO identities (provider, provider_user_id, user_id) VALUES (?, ?, ?)")
      .bind(provider, providerUserId, created.id)
      .run();
    const reader = await this.findReader(provider, providerUserId);
    if (!reader) throw new Error("Identity missing right after insert");
    if (reader.id !== created.id) await this.db.prepare("DELETE FROM users WHERE id = ?").bind(created.id).run();
    return reader;
  }

  async logDailyReading(readerId: number, localDate: string, page: number, source: "telegram"): Promise<boolean> {
    const result = await this.db
      .prepare("INSERT OR IGNORE INTO reading_log (user_id, local_date, page, source) VALUES (?, ?, ?, ?)")
      .bind(readerId, localDate, page, source)
      .run();
    return result.meta.changes > 0;
  }

  async addPageToKhatma(readerId: number, khatma: number, page: number): Promise<number> {
    const [, count] = await this.db.batch<{ n: number }>([
      this.db
        .prepare("INSERT OR IGNORE INTO pages_read (user_id, khatma, page) VALUES (?, ?, ?)")
        .bind(readerId, khatma, page),
      this.db.prepare("SELECT COUNT(*) AS n FROM pages_read WHERE user_id = ? AND khatma = ?").bind(readerId, khatma),
    ]);
    return count?.results[0]?.n ?? 0;
  }

  async startNextKhatma(readerId: number): Promise<void> {
    await this.db.prepare("UPDATE users SET current_khatma = current_khatma + 1 WHERE id = ?").bind(readerId).run();
  }

  private findReader(provider: string, providerUserId: string): Promise<Reader | null> {
    return this.db
      .prepare(
        `SELECT u.id, u.timezone, u.current_khatma FROM identities i JOIN users u ON u.id = i.user_id
         WHERE i.provider = ? AND i.provider_user_id = ?`,
      )
      .bind(provider, providerUserId)
      .first<ReaderRow>()
      .then((row) => (row ? toReader(row) : null));
  }
}

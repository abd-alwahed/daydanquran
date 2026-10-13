import { findCity, type IsoDate, type ReminderKind, type ReminderSettings } from "@daydan/core";
import { decodeTime, encodeTime, type ActiveReminder, type ReminderFlags, type ReminderStore, type StoredReminder } from "./store";

interface ReminderRow {
  user_id: number;
  chat_id: string;
  city: string;
  time: string;
  evening_nudge: number;
  ramadan_message: number;
  enabled: number;
  since: string;
}

interface ActiveRow extends ReminderRow {
  last_read: string | null;
  last_weekly: string | null;
  /** "YYYY-MM-DD kind,YYYY-MM-DD kind,…" */
  recent: string | null;
}

/** Null for a row that no longer decodes (e.g. a city removed from the list): it is skipped, not sent. */
function toStored(row: ReminderRow): StoredReminder | null {
  const city = findCity(row.city);
  const time = decodeTime(row.time);
  if (!city || !time) return null;
  const settings: ReminderSettings = {
    city,
    time,
    eveningNudge: row.evening_nudge === 1,
    ramadanMessage: row.ramadan_message === 1,
  };
  return { userId: row.user_id, chatId: row.chat_id, settings, enabled: row.enabled === 1 };
}

export class D1ReminderStore implements ReminderStore {
  constructor(private readonly db: D1Database) {}

  async listActive(recentFrom: IsoDate): Promise<ActiveReminder[]> {
    const { results } = await this.db
      .prepare(
        `SELECT r.*,
           (SELECT MAX(local_date) FROM reading_log l WHERE l.user_id = r.user_id) AS last_read,
           (SELECT MAX(local_date) FROM reminder_sends s WHERE s.user_id = r.user_id AND s.kind = 'weekly') AS last_weekly,
           (SELECT group_concat(s.local_date || ' ' || s.kind) FROM reminder_sends s
             WHERE s.user_id = r.user_id AND s.local_date >= ?) AS recent
         FROM reminders r WHERE r.enabled = 1`,
      )
      .bind(recentFrom)
      .all<ActiveRow>();
    return results.flatMap((row) => {
      const stored = toStored(row);
      if (!stored) return [];
      const history = {
        since: row.since,
        lastRead: row.last_read,
        lastWeekly: row.last_weekly,
        sent: new Set(row.recent ? row.recent.split(",") : []),
      };
      return [{ ...stored, history }];
    });
  }

  async claim(userId: number, localDate: IsoDate, kind: ReminderKind): Promise<boolean> {
    const result = await this.db
      .prepare(
        `INSERT OR IGNORE INTO reminder_sends (user_id, local_date, kind)
         SELECT ?1, ?2, ?3 WHERE NOT EXISTS (SELECT 1 FROM reading_log WHERE user_id = ?1 AND local_date = ?2)`,
      )
      .bind(userId, localDate, kind)
      .run();
    return result.meta.changes > 0;
  }

  async release(userId: number, localDate: IsoDate, kind: ReminderKind): Promise<void> {
    await this.db
      .prepare("DELETE FROM reminder_sends WHERE user_id = ? AND local_date = ? AND kind = ?")
      .bind(userId, localDate, kind)
      .run();
  }

  async get(userId: number): Promise<StoredReminder | null> {
    const row = await this.db.prepare("SELECT * FROM reminders WHERE user_id = ?").bind(userId).first<ReminderRow>();
    return row ? toStored(row) : null;
  }

  async save(userId: number, chatId: string, settings: ReminderSettings, since: IsoDate): Promise<void> {
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO reminders (user_id, chat_id, city, time, evening_nudge, ramadan_message, enabled, since)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?)
           ON CONFLICT (user_id) DO UPDATE SET chat_id = excluded.chat_id, city = excluded.city, time = excluded.time,
             evening_nudge = excluded.evening_nudge, ramadan_message = excluded.ramadan_message, enabled = 1,
             since = excluded.since, updated_at = datetime('now')`,
        )
        .bind(
          userId,
          chatId,
          settings.city.id,
          encodeTime(settings.time),
          settings.eveningNudge ? 1 : 0,
          settings.ramadanMessage ? 1 : 0,
          since,
        ),
      this.db.prepare("UPDATE users SET timezone = ? WHERE id = ?").bind(settings.city.timeZone, userId),
    ]);
  }

  async update(userId: number, flags: ReminderFlags): Promise<void> {
    const columns = { eveningNudge: "evening_nudge", ramadanMessage: "ramadan_message", enabled: "enabled" } as const;
    const set = (Object.keys(flags) as (keyof ReminderFlags)[]).filter((key) => flags[key] !== undefined);
    if (set.length === 0) return;
    await this.db
      .prepare(
        `UPDATE reminders SET ${set.map((key) => `${columns[key]} = ?`).join(", ")}, updated_at = datetime('now')
         WHERE user_id = ?`,
      )
      .bind(...set.map((key) => (flags[key] ? 1 : 0)), userId)
      .run();
  }
}

import type { IsoDate, ReminderKind, ReminderSettings } from "@daydan/core";
import type { ActiveReminder, ReminderFlags, ReminderStore, StoredReminder } from "./store";

/** In-memory ReminderStore with the same rules as the D1 schema. For tests. */
export class MemoryReminderStore implements ReminderStore {
  readonly reminders = new Map<number, StoredReminder & { since: IsoDate }>();
  /** "userId localDate kind" */
  readonly sends = new Set<string>();
  /** "userId localDate": the readers' daily reading log. */
  readonly readings = new Set<string>();

  async listActive(recentFrom: IsoDate): Promise<ActiveReminder[]> {
    return [...this.reminders.values()]
      .filter((r) => r.enabled)
      .map(({ since, ...r }) => {
        const mine = (set: Set<string>) =>
          [...set].filter((key) => key.startsWith(`${r.userId} `)).map((key) => key.slice(`${r.userId} `.length));
        const readDates = mine(this.readings).sort();
        const sends = mine(this.sends);
        const weekly = sends.filter((s) => s.endsWith(" weekly")).map((s) => s.slice(0, 10)).sort();
        return {
          ...r,
          history: {
            since,
            lastRead: readDates.at(-1) ?? null,
            lastWeekly: weekly.at(-1) ?? null,
            sent: new Set(sends.filter((s) => s.slice(0, 10) >= recentFrom)),
          },
        };
      });
  }

  async claim(userId: number, localDate: IsoDate, kind: ReminderKind): Promise<boolean> {
    const key = `${userId} ${localDate} ${kind}`;
    if (this.sends.has(key) || this.readings.has(`${userId} ${localDate}`)) return false;
    this.sends.add(key);
    return true;
  }

  async release(userId: number, localDate: IsoDate, kind: ReminderKind): Promise<void> {
    this.sends.delete(`${userId} ${localDate} ${kind}`);
  }

  async get(userId: number): Promise<StoredReminder | null> {
    const found = this.reminders.get(userId);
    return found ? { userId: found.userId, chatId: found.chatId, settings: found.settings, enabled: found.enabled } : null;
  }

  async save(userId: number, chatId: string, settings: ReminderSettings, since: IsoDate): Promise<void> {
    this.reminders.set(userId, { userId, chatId, settings, enabled: true, since });
  }

  async update(userId: number, { enabled, ...flags }: ReminderFlags): Promise<void> {
    const found = this.reminders.get(userId);
    if (!found) return;
    const settings = { ...found.settings };
    if (flags.eveningNudge !== undefined) settings.eveningNudge = flags.eveningNudge;
    if (flags.ramadanMessage !== undefined) settings.ramadanMessage = flags.ramadanMessage;
    this.reminders.set(userId, { ...found, settings, enabled: enabled ?? found.enabled });
  }
}

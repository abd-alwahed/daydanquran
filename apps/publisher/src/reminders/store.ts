import { PRAYERS, type IsoDate, type Prayer, type ReminderHistory, type ReminderKind, type ReminderSettings, type ReminderTime } from "@daydan/core";

export interface StoredReminder {
  userId: number;
  chatId: string;
  settings: ReminderSettings;
  enabled: boolean;
}

/** An enabled reminder with the reading history its rules need. */
export interface ActiveReminder extends StoredReminder {
  history: ReminderHistory;
}

export type ReminderFlags = Partial<Pick<ReminderSettings, "eveningNudge" | "ramadanMessage"> & { enabled: boolean }>;

/** Storage for reminders. D1 today; another backend can implement the same contract. */
export interface ReminderStore {
  /** Every enabled reminder. Sends older than `recentFrom` are left out of `history.sent`. */
  listActive(recentFrom: IsoDate): Promise<ActiveReminder[]>;
  /**
   * Records (reader, local date, kind) as sent, unless it already is or the reader has a reading on
   * that date. Returns false in both cases. Checked atomically, right before sending.
   */
  claim(userId: number, localDate: IsoDate, kind: ReminderKind): Promise<boolean>;
  /** Undoes a claim whose message could not be sent, so the next run tries again. */
  release(userId: number, localDate: IsoDate, kind: ReminderKind): Promise<void>;
  get(userId: number): Promise<StoredReminder | null>;
  /** Creates or replaces the reader's reminder (enabled), and moves the reader to the city's clock. */
  save(userId: number, chatId: string, settings: ReminderSettings, since: IsoDate): Promise<void>;
  update(userId: number, flags: ReminderFlags): Promise<void>;
}

export const encodeTime = (time: ReminderTime): string =>
  time.kind === "fixed" ? `fixed:${time.minutes}` : `prayer:${time.prayer}`;

export function decodeTime(value: string): ReminderTime | null {
  const [kind, rest = ""] = value.split(":");
  if (kind === "fixed") {
    const minutes = Number(rest);
    return Number.isInteger(minutes) && minutes >= 0 && minutes < 24 * 60 ? { kind, minutes } : null;
  }
  if (kind === "prayer" && (PRAYERS as readonly string[]).includes(rest)) return { kind, prayer: rest as Prayer };
  return null;
}

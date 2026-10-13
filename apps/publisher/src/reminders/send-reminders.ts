import { LAUNCH_DATE, SITE_URL, dueReminder, localDate, todaysPage } from "@daydan/core";
import { readButton } from "../read-button";
import { TelegramError, type TelegramClient } from "../telegram";
import { reminderText, surahFromCaption } from "./messages";
import type { ReminderStore } from "./store";

export interface ReminderDeps {
  store: ReminderStore;
  telegram: Pick<TelegramClient, "sendMessage">;
  /** Dry run sends only to the admin's own chat, so the owner can try reminders on themselves. */
  config: { enabled: boolean; dryRun: boolean; adminChatId: string };
  fetchImpl?: typeof fetch;
}

export type ReminderRunResult =
  | { status: "skipped"; reason: string }
  | { status: "done"; sent: number; alreadyDone: number; blocked: number; failed: number; deferred: number; dryRunSkipped: number };

/**
 * Two subrequests per reminder (claim + send). Workers Free allows 50 per run, so a run sends at
 * most this many; the rest are sent by the next run (every 15 minutes) within the send window.
 */
export const MAX_SENDS_PER_RUN = 20;

/** Days of sends the rules need to see. Covers every time zone's "today". */
const RECENT_DAYS = 2;

/** Sends every reminder due now. Safe to re-run: each (reader, local date, kind) is sent once. */
export async function sendDueReminders(deps: ReminderDeps, now: Date): Promise<ReminderRunResult> {
  if (!deps.config.enabled) return { status: "skipped", reason: "reminders disabled (kill switch)" };
  const today = todaysPage(LAUNCH_DATE, now);
  if (!today) return { status: "skipped", reason: "before launch" };

  const recentFrom = localDate(new Date(now.getTime() - RECENT_DAYS * 86_400_000), "UTC");
  const due = (await deps.store.listActive(recentFrom)).flatMap((reminder) => {
    const next = dueReminder(reminder.settings, reminder.history, now);
    return next ? [{ reminder, next }] : [];
  });
  if (due.length === 0) return { status: "done", sent: 0, alreadyDone: 0, blocked: 0, failed: 0, deferred: 0, dryRunSkipped: 0 };

  // The reminder links to the day's page, so a page that is not on the site (not approved) is never announced.
  const fetchImpl = deps.fetchImpl ?? fetch;
  const caption = await fetchImpl(`${SITE_URL}/p/${today.page}/caption.txt`);
  if (!caption.ok) return { status: "skipped", reason: `page ${today.page} is not on the site (${caption.status})` };
  const surah = surahFromCaption(await caption.text());

  const result = { status: "done" as const, sent: 0, alreadyDone: 0, blocked: 0, failed: 0, deferred: 0, dryRunSkipped: 0 };
  const recipients = due.filter(({ reminder }) => {
    if (!deps.config.dryRun || reminder.chatId === deps.config.adminChatId) return true;
    result.dryRunSkipped++;
    return false;
  });
  result.deferred = Math.max(0, recipients.length - MAX_SENDS_PER_RUN);

  for (const { reminder, next } of recipients.slice(0, MAX_SENDS_PER_RUN)) {
    // Re-checks the reading status at send time: a reader who pressed «قرأت» since the list was read is skipped.
    if (!(await deps.store.claim(reminder.userId, next.localDate, next.kind))) {
      result.alreadyDone++;
      continue;
    }
    try {
      await deps.telegram.sendMessage(reminder.chatId, reminderText(next, today.page, surah), {
        buttons: [[readButton(today.page)]],
      });
      result.sent++;
    } catch (error) {
      if (error instanceof TelegramError && error.code === 403) {
        // The reader blocked the bot or left Telegram. Stop quietly; /reminder turns it back on.
        await deps.store.update(reminder.userId, { enabled: false });
        result.blocked++;
      } else {
        await deps.store.release(reminder.userId, next.localDate, next.kind);
        result.failed++;
      }
    }
  }
  return result;
}

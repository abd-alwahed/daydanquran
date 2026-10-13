import { findCity, localDate, toArabicDigits, type ReminderSettings } from "@daydan/core";
import type { ReadingStore } from "../reading/store";
import type { InlineButton } from "../telegram";
import type { ReminderStore, StoredReminder } from "./store";

/** Callback data of every reminder-settings button starts with this. */
export const SETTINGS_PREFIX = "rem:";

/**
 * For now everyone is reminded at 07:00 Mecca time (the owner's decision, 2026-10-13); the reader
 * only turns it on or off. The rules in @daydan/core also support a chosen city and prayer.
 */
export const DEFAULT_REMINDER: Omit<ReminderSettings, "eveningNudge" | "ramadanMessage"> = {
  city: findCity("riyadh")!,
  time: { kind: "fixed", minutes: 7 * 60 },
};

const button = (text: string, data: string): InlineButton => ({ text, callback_data: `${SETTINGS_PREFIX}${data}` });

export interface Screen {
  text: string;
  buttons: InlineButton[][];
}

export function summaryScreen({ settings }: Pick<StoredReminder, "settings">): Screen {
  const on = (value: boolean) => (value ? "مفعّل" : "موقوف");
  return {
    text: [
      "يصلك التذكير كل يوم الساعة ٧ صباحاً بتوقيت مكة المكرمة، ما لم تكن قرأت وِردك.",
      "وإذا ضغطت «قرأت الورد ✅» في القناة أو تحت التذكير، لا يصلك تذكير ذلك اليوم.",
    ].join("\n"),
    buttons: [
      [button(`تذكير مسائي الساعة ${toArabicDigits(9)} م: ${on(settings.eveningNudge)}`, "nudge")],
      [button(`رسالة بداية رمضان: ${on(settings.ramadanMessage)}`, "ramadan")],
      [button("إيقاف التذكير", "off")],
    ],
  };
}

const OFF_SCREEN: Screen = { text: "أوقفنا التذكير. ويمكنك تفعيله متى شئت بالأمر /reminder", buttons: [] };

export interface SettingsDeps {
  readers: ReadingStore;
  reminders: ReminderStore;
  now: () => Date;
}

/** /reminder: turns the reminder on (keeping the reader's earlier toggles) and shows it. */
export async function reminderCommand(deps: SettingsDeps, telegramUserId: string, chatId: string): Promise<Screen> {
  const reader = await deps.readers.findOrCreateReader("telegram", telegramUserId);
  const current = await deps.reminders.get(reader.id);
  if (current?.enabled) return summaryScreen(current);
  const settings: ReminderSettings = {
    ...DEFAULT_REMINDER,
    eveningNudge: current?.settings.eveningNudge ?? true,
    ramadanMessage: current?.settings.ramadanMessage ?? true,
  };
  await deps.reminders.save(reader.id, chatId, settings, localDate(deps.now(), settings.city.timeZone));
  return summaryScreen({ settings });
}

/** /stop */
export async function stopCommand(deps: SettingsDeps, telegramUserId: string): Promise<Screen> {
  const reader = await deps.readers.findOrCreateReader("telegram", telegramUserId);
  await deps.reminders.update(reader.id, { enabled: false });
  return OFF_SCREEN;
}

/** A press on a settings button. Returns the screen that replaces the pressed message, or null to leave it. */
export async function settingsCallback(deps: SettingsDeps, telegramUserId: string, data: string): Promise<Screen | null> {
  const action = data.slice(SETTINGS_PREFIX.length);
  const reader = await deps.readers.findOrCreateReader("telegram", telegramUserId);
  const current = await deps.reminders.get(reader.id);
  if (!current?.enabled) return OFF_SCREEN;
  if (action === "off") {
    await deps.reminders.update(reader.id, { enabled: false });
    return OFF_SCREEN;
  }
  if (action === "nudge" || action === "ramadan") {
    const settings = { ...current.settings };
    if (action === "nudge") settings.eveningNudge = !settings.eveningNudge;
    else settings.ramadanMessage = !settings.ramadanMessage;
    await deps.reminders.update(reader.id, { eveningNudge: settings.eveningNudge, ramadanMessage: settings.ramadanMessage });
    return summaryScreen({ settings });
  }
  return null;
}

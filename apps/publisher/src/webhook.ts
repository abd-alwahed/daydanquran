import { SITE_URL } from "@daydan/core";
import { ABOUT, khatmaCommand, makeupCommand, readCommand, todayCommand, type Reply } from "./commands";
import { parseReadButton } from "./read-button";
import { readingReply } from "./reading/messages";
import { recordReading } from "./reading/record-reading";
import type { ReadingStore } from "./reading/store";
import { SETTINGS_PREFIX, reminderCommand, settingsCallback, stopCommand, type Screen } from "./reminders/settings";
import type { ReminderStore } from "./reminders/store";
import type { TelegramClient } from "./telegram";
import { secretsMatch } from "./webhook-secret";

/** The parts of a Telegram Update we act on. */
export interface TelegramUpdate {
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { message_id: number; chat: { id: number; type: string } };
  };
  message?: { chat: { id: number; type: string }; text?: string };
}

export interface WebhookDeps {
  telegram: Pick<TelegramClient, "answerCallbackQuery" | "sendMessage" | "editMessageText">;
  store: ReadingStore;
  reminders: ReminderStore;
  expectedSecret: string;
  now: () => Date;
  /** Reads the day's caption from the site for /today. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export const ALLOWED_UPDATES = ["callback_query", "message"];

const WELCOME = [
  "الدَّيْدَن: العادة الدائمة التي لا تنقطع.",
  "صفحة من القرآن كل يوم، حتى يصير القرآن دَيْدَنك.",
  "",
  `صفحة اليوم مع التفسير والتلاوة: ${SITE_URL}`,
  "وبعد قراءتك اضغط «قرأت الورد ✅» هنا أو في القناة @daydanquran، فنحفظ لك ختمتك.",
  "",
  // Arabic first on each line, so Telegram lays the line out right to left.
  "صفحة اليوم: /today",
  "قرأت وِرد اليوم: /read",
  "ختمتي: /khatma",
  "اقضِ ما فاتك: /makeup",
  "تذكير يومي الساعة ٧ صباحاً: /reminder",
  "عن دَيْدَن: /about",
].join("\n");

/** "/reminder" or "/reminder@bot_name". */
const isCommand = (text: string | undefined, command: string) => text?.split(/[\s@]/)[0] === command;

/**
 * Handles a Telegram webhook call. Always answers 200 for authentic calls, even when the update
 * is ignored, so Telegram does not retry it; answers 401 when the secret header is wrong.
 */
export async function handleWebhook(request: Request, deps: WebhookDeps): Promise<Response> {
  if (!secretsMatch(request.headers.get("x-telegram-bot-api-secret-token"), deps.expectedSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const update = (await request.json()) as TelegramUpdate;

  const settings = { readers: deps.store, reminders: deps.reminders, now: deps.now };
  const show = (chatId: string, reply: Screen | Reply) => deps.telegram.sendMessage(chatId, reply.text, { buttons: reply.buttons });

  const query = update.callback_query;
  if (query) {
    const page = parseReadButton(query.data);
    const pressedIn = query.message;
    if (page !== null) {
      const outcome = await recordReading(deps.store, String(query.from.id), page, deps.now());
      await deps.telegram.answerCallbackQuery(query.id, readingReply(outcome));
    } else if (query.data?.startsWith(SETTINGS_PREFIX) && pressedIn?.chat.type === "private") {
      const chatId = String(pressedIn.chat.id);
      const screen = await settingsCallback(settings, String(query.from.id), query.data);
      await deps.telegram.answerCallbackQuery(query.id, "");
      if (screen) await deps.telegram.editMessageText(chatId, pressedIn.message_id, screen.text, { buttons: screen.buttons });
    } else {
      await deps.telegram.answerCallbackQuery(query.id, "");
    }
  }

  const message = update.message;
  if (message?.chat.type === "private") {
    // In a private chat the chat id is the user's id.
    const chatId = String(message.chat.id);
    const userId = chatId;
    const now = deps.now();
    if (isCommand(message.text, "/start")) await deps.telegram.sendMessage(chatId, WELCOME);
    else if (isCommand(message.text, "/today")) await show(chatId, await todayCommand(now, deps.fetchImpl));
    else if (isCommand(message.text, "/read")) await show(chatId, await readCommand(deps.store, userId, now));
    else if (isCommand(message.text, "/khatma")) await show(chatId, await khatmaCommand(deps.store, userId));
    else if (isCommand(message.text, "/makeup")) await show(chatId, await makeupCommand(deps.store, userId, now));
    else if (isCommand(message.text, "/about")) await deps.telegram.sendMessage(chatId, ABOUT);
    else if (isCommand(message.text, "/reminder")) await show(chatId, await reminderCommand(settings, userId, chatId));
    else if (isCommand(message.text, "/stop")) await show(chatId, await stopCommand(settings, userId));
  }

  return new Response("OK");
}

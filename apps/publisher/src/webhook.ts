import { SITE_URL } from "@daydan/core";
import { parseReadButton } from "./read-button";
import { readingReply } from "./reading/messages";
import { recordReading } from "./reading/record-reading";
import type { ReadingStore } from "./reading/store";
import type { TelegramClient } from "./telegram";
import { secretsMatch } from "./webhook-secret";

/** The parts of a Telegram Update we act on. */
export interface TelegramUpdate {
  callback_query?: { id: string; from: { id: number }; data?: string };
  message?: { chat: { id: number; type: string }; text?: string };
}

export interface WebhookDeps {
  telegram: Pick<TelegramClient, "answerCallbackQuery" | "sendMessage">;
  store: ReadingStore;
  expectedSecret: string;
  now: () => Date;
}

export const ALLOWED_UPDATES = ["callback_query", "message"];

const WELCOME = [
  "الدَّيْدَن: العادة الدائمة التي لا تنقطع.",
  "صفحة من القرآن كل يوم، حتى يصير القرآن دَيْدَنك.",
  "",
  `صفحة اليوم مع التفسير والتلاوة: ${SITE_URL}`,
  "وفي القناة @daydanquran اضغط «قرأت الورد ✅» بعد قراءتك، فنحفظ لك ختمتك.",
].join("\n");

/**
 * Handles a Telegram webhook call. Always answers 200 for authentic calls, even when the update
 * is ignored, so Telegram does not retry it; answers 401 when the secret header is wrong.
 */
export async function handleWebhook(request: Request, deps: WebhookDeps): Promise<Response> {
  if (!secretsMatch(request.headers.get("x-telegram-bot-api-secret-token"), deps.expectedSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const update = (await request.json()) as TelegramUpdate;

  const query = update.callback_query;
  if (query) {
    const page = parseReadButton(query.data);
    if (page === null) {
      await deps.telegram.answerCallbackQuery(query.id, "");
    } else {
      const outcome = await recordReading(deps.store, String(query.from.id), page, deps.now());
      await deps.telegram.answerCallbackQuery(query.id, readingReply(outcome));
    }
  }

  const message = update.message;
  if (message?.chat.type === "private" && message.text?.startsWith("/start")) {
    await deps.telegram.sendMessage(String(message.chat.id), WELCOME);
  }

  return new Response("OK");
}

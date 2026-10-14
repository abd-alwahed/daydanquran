export interface InputMediaPhoto {
  type: "photo";
  media: string;
  caption?: string;
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

/** A Bot API call Telegram refused. `code` is its error_code (403: the user blocked the bot). */
export class TelegramError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
  }
}

const keyboard = (buttons?: InlineButton[][]) => (buttons ? { inline_keyboard: buttons } : undefined);

/** "123456789:AA…" — digits, colon, 35 URL-safe characters. */
const TOKEN_SHAPE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;

/** Describes what is wrong with a token without revealing it. */
export function describeTokenProblem(token: string | undefined): string | null {
  if (!token) return "TELEGRAM_BOT_TOKEN غير موجود أو فارغ";
  if (!TOKEN_SHAPE.test(token)) return `TELEGRAM_BOT_TOKEN بصيغة غير صحيحة (طوله ${token.length} حرفاً)`;
  return null;
}

/** The few Bot API calls we use. */
export class TelegramClient {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly token: string,
    fetchImpl: typeof fetch = fetch,
  ) {
    const problem = describeTokenProblem(token);
    if (problem) throw new Error(problem);
    // Workers throw "Illegal invocation" when fetch is called as a method of another object
    // (this.fetchImpl(...)), so keep a wrapper that calls it as a plain function.
    this.fetchImpl = (input, init) => fetchImpl(input, init);
  }

  sendPhoto(chatId: string, photo: string, options: { caption?: string; buttons?: InlineButton[][] } = {}): Promise<unknown> {
    return this.call("sendPhoto", {
      chat_id: chatId,
      photo,
      caption: options.caption,
      reply_markup: keyboard(options.buttons),
    });
  }

  /** Two to ten photos shown as one album. */
  sendMediaGroup(chatId: string, media: InputMediaPhoto[]): Promise<unknown> {
    return this.call("sendMediaGroup", { chat_id: chatId, media });
  }

  /**
   * Sends a file as a document, so Telegram keeps it at full size (a photo would be shrunk).
   * Uploaded, because Telegram fetches documents by URL only for GIF, PDF and ZIP.
   */
  sendDocument(chatId: string, file: Blob, fileName: string, options: { caption?: string } = {}): Promise<unknown> {
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("document", file, fileName);
    if (options.caption) form.append("caption", options.caption);
    return this.call("sendDocument", form);
  }

  sendMessage(chatId: string, text: string, options: { buttons?: InlineButton[][] } = {}): Promise<unknown> {
    return this.call("sendMessage", { chat_id: chatId, text, reply_markup: keyboard(options.buttons) });
  }

  editMessageText(chatId: string, messageId: number, text: string, options: { buttons?: InlineButton[][] } = {}): Promise<unknown> {
    return this.call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: keyboard(options.buttons),
    });
  }

  /** The small notice shown only to the person who pressed the button. */
  answerCallbackQuery(callbackQueryId: string, text: string): Promise<unknown> {
    return this.call("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
  }

  setWebhook(url: string, secretToken: string, allowedUpdates: string[]): Promise<unknown> {
    return this.call("setWebhook", { url, secret_token: secretToken, allowed_updates: allowedUpdates });
  }

  private async call<T>(method: string, body: object): Promise<T> {
    const response = await this.fetchImpl(
      `https://api.telegram.org/bot${this.token}/${method}`,
      // FormData sets its own multipart content type.
      body instanceof FormData
        ? { method: "POST", body }
        : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
    const json = (await response.json()) as TelegramResponse<T>;
    // The Bot API answers 404 for every method when the token itself is wrong or revoked.
    if (response.status === 404) throw new Error(`Telegram ${method}: توكن البوت غير صالح أو أُلغي (404)`);
    if (!json.ok) {
      throw new TelegramError(`Telegram ${method}: ${json.description ?? response.status}`, json.error_code ?? response.status);
    }
    return json.result as T;
  }
}

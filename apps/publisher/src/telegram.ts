export interface InputMediaPhoto {
  type: "photo";
  media: string;
  caption?: string;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

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

  sendMediaGroup(chatId: string, media: InputMediaPhoto[]): Promise<unknown> {
    return this.call("sendMediaGroup", { chat_id: chatId, media });
  }

  sendMessage(chatId: string, text: string): Promise<unknown> {
    return this.call("sendMessage", { chat_id: chatId, text });
  }

  private async call<T>(method: string, body: object): Promise<T> {
    const response = await this.fetchImpl(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as TelegramResponse<T>;
    // The Bot API answers 404 for every method when the token itself is wrong or revoked.
    if (response.status === 404) throw new Error(`Telegram ${method}: توكن البوت غير صالح أو أُلغي (404)`);
    if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? response.status}`);
    return json.result as T;
  }
}

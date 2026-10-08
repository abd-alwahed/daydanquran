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

/** The few Bot API calls we use. */
export class TelegramClient {
  constructor(
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

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
    if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? response.status}`);
    return json.result as T;
  }
}

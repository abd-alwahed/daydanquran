import { beforeEach, describe, expect, it } from "vitest";
import { LAUNCH_DATE } from "@daydan/core";
import { parseReadButton, readButton } from "./read-button";
import { MemoryReadingStore } from "./reading/memory-store";
import { handleWebhook, type TelegramUpdate, type WebhookDeps } from "./webhook";
import { secretsMatch, webhookSecret } from "./webhook-secret";

const SECRET = "s3cret";
const LAUNCH_NOON = new Date(`${LAUNCH_DATE}T09:00:00Z`);

const call = (update: TelegramUpdate, secret: string | null = SECRET) =>
  new Request("https://example.com/telegram/webhook", {
    method: "POST",
    headers: secret === null ? {} : { "x-telegram-bot-api-secret-token": secret },
    body: JSON.stringify(update),
  });

const press = (userId: number, data: string): TelegramUpdate => ({
  callback_query: { id: `q${userId}`, from: { id: userId }, data },
});

describe("handleWebhook", () => {
  let answers: string[];
  let messages: { chatId: string; text: string }[];
  let deps: WebhookDeps;

  beforeEach(() => {
    answers = [];
    messages = [];
    deps = {
      telegram: {
        answerCallbackQuery: async (_id, text) => void answers.push(text),
        sendMessage: async (chatId, text) => void messages.push({ chatId, text }),
      },
      store: new MemoryReadingStore(),
      expectedSecret: SECRET,
      now: () => LAUNCH_NOON,
    };
  });

  it("rejects calls without the right secret and records nothing", async () => {
    expect((await handleWebhook(call(press(1, "read:1"), "wrong"), deps)).status).toBe(401);
    expect((await handleWebhook(call(press(1, "read:1"), null), deps)).status).toBe(401);
    expect(answers).toHaveLength(0);
  });

  it("records a press and answers the reader privately with their khatma", async () => {
    const response = await handleWebhook(call(press(7, "read:1")), deps);
    expect(response.status).toBe(200);
    expect(answers).toEqual(["تقبّل الله ✅ ختمتك: ١ من ٦٠٤ صفحة"]);
  });

  it("counts a page once per reader, however often it is pressed", async () => {
    await handleWebhook(call(press(7, "read:1")), deps);
    await handleWebhook(call(press(7, "read:1")), deps);
    expect(answers.at(-1)).toContain("١ من ٦٠٤");
  });

  it("answers a malformed button without recording anything", async () => {
    await handleWebhook(call(press(7, "read:999")), deps);
    expect(answers).toEqual([""]);
    expect((deps.store as MemoryReadingStore).readers).toHaveLength(0);
  });

  it("welcomes /start in a private chat only", async () => {
    await handleWebhook(call({ message: { chat: { id: 5, type: "private" }, text: "/start" } }), deps);
    await handleWebhook(call({ message: { chat: { id: -9, type: "group" }, text: "/start" } }), deps);
    expect(messages.map((m) => m.chatId)).toEqual(["5"]);
  });
});

describe("read button", () => {
  it("round-trips the page and rejects anything else", () => {
    expect(parseReadButton(readButton(245).callback_data)).toBe(245);
    for (const data of [undefined, "", "read:", "read:0", "read:605", "read:1.5", "other:1"]) {
      expect(parseReadButton(data)).toBeNull();
    }
  });
});

describe("webhook secret", () => {
  it("is derived deterministically, uses only allowed characters, and never equals the token", async () => {
    const token = "123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const secret = await webhookSecret(token);
    expect(secret).toBe(await webhookSecret(token));
    expect(secret).toMatch(/^[a-f0-9]{64}$/);
    expect(secret).not.toContain(token);
  });

  it("compares exactly", () => {
    expect(secretsMatch("abc", "abc")).toBe(true);
    expect(secretsMatch("abd", "abc")).toBe(false);
    expect(secretsMatch("ab", "abc")).toBe(false);
    expect(secretsMatch(null, "abc")).toBe(false);
  });
});

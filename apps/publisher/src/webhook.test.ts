import { beforeEach, describe, expect, it } from "vitest";
import { LAUNCH_DATE } from "@daydan/core";
import { parseReadButton, readButton } from "./read-button";
import { MemoryReadingStore } from "./reading/memory-store";
import { MemoryReminderStore } from "./reminders/memory-store";
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
  let edits: { chatId: string; messageId: number; text: string; buttons: string[] }[];
  let reminders: MemoryReminderStore;
  let deps: WebhookDeps;

  beforeEach(() => {
    answers = [];
    messages = [];
    edits = [];
    reminders = new MemoryReminderStore();
    deps = {
      telegram: {
        answerCallbackQuery: async (_id, text) => void answers.push(text),
        sendMessage: async (chatId, text) => void messages.push({ chatId, text }),
        editMessageText: async (chatId, messageId, text, options) =>
          void edits.push({ chatId, messageId, text, buttons: options?.buttons?.flat().map((b) => b.callback_data) ?? [] }),
      },
      store: new MemoryReadingStore(),
      reminders,
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

  it("answers every command in the bot's menu", async () => {
    deps.fetchImpl = async () => new Response("سورة الفاتحة · الجزء ١");
    for (const text of ["/today", "/read", "/khatma", "/makeup", "/about", "/khatma@Daydanquran_bot"]) {
      await handleWebhook(call({ message: { chat: { id: 5, type: "private" }, text } }), deps);
    }
    expect(messages).toHaveLength(6);
    expect(messages[2]?.text).toBe("ختمتك: ١ من ٦٠٤ صفحة.");
  });
});

describe("reminder settings in the bot", () => {
  let messages: string[];
  let edits: { text: string; buttons: string[] }[];
  let reminders: MemoryReminderStore;
  let deps: WebhookDeps;

  const command = (text: string) => call({ message: { chat: { id: 7, type: "private" }, text } });
  const tap = (data: string): TelegramUpdate => ({
    callback_query: { id: "q", from: { id: 7 }, data, message: { message_id: 50, chat: { id: 7, type: "private" } } },
  });

  beforeEach(() => {
    messages = [];
    edits = [];
    reminders = new MemoryReminderStore();
    deps = {
      telegram: {
        answerCallbackQuery: async () => {},
        sendMessage: async (_chatId, text) => void messages.push(text),
        editMessageText: async (_chatId, _messageId, text, options) =>
          void edits.push({ text, buttons: options?.buttons?.flat().map((b) => b.callback_data) ?? [] }),
      },
      store: new MemoryReadingStore(),
      reminders,
      expectedSecret: SECRET,
      now: () => LAUNCH_NOON,
    };
  });

  it("/reminder turns on the 07:00 Mecca reminder", async () => {
    await handleWebhook(command("/reminder"), deps);
    expect(messages[0]).toContain("الساعة ٧ صباحاً بتوقيت مكة المكرمة");
    const saved = await reminders.get(1);
    expect(saved).toMatchObject({ chatId: "7", enabled: true, settings: { time: { kind: "fixed", minutes: 420 } } });
    expect(saved?.settings.city.timeZone).toBe("Asia/Riyadh");
    expect(reminders.reminders.get(1)?.since).toBe(LAUNCH_DATE);
  });

  it("toggles the evening nudge and the Ramadan message, stops, and keeps the toggles when turned back on", async () => {
    await handleWebhook(command("/reminder"), deps);
    await handleWebhook(call(tap("rem:nudge")), deps);
    await handleWebhook(call(tap("rem:ramadan")), deps);
    expect(edits.at(-1)?.buttons).toEqual(["rem:nudge", "rem:ramadan", "rem:off"]);
    expect((await reminders.get(1))?.settings).toMatchObject({ eveningNudge: false, ramadanMessage: false });

    await handleWebhook(call(tap("rem:off")), deps);
    expect((await reminders.get(1))?.enabled).toBe(false);
    await handleWebhook(command("/reminder"), deps);
    expect(await reminders.get(1)).toMatchObject({ enabled: true, settings: { eveningNudge: false, ramadanMessage: false } });

    await handleWebhook(command("/stop"), deps);
    expect((await reminders.get(1))?.enabled).toBe(false);
  });

  it("ignores settings buttons pressed outside a private chat or before /reminder", async () => {
    await handleWebhook(call(tap("rem:nudge")), deps);
    expect(reminders.reminders.size).toBe(0);
    await handleWebhook(command("/reminder"), deps);
    const inGroup: TelegramUpdate = {
      callback_query: { id: "q", from: { id: 7 }, data: "rem:off", message: { message_id: 1, chat: { id: -5, type: "group" } } },
    };
    await handleWebhook(call(inGroup), deps);
    expect((await reminders.get(1))?.enabled).toBe(true);
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

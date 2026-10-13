import { beforeEach, describe, expect, it } from "vitest";
import { findCity, type ReminderSettings } from "@daydan/core";
import { TelegramError } from "../telegram";
import { MemoryReminderStore } from "./memory-store";
import { MAX_SENDS_PER_RUN, sendDueReminders, type ReminderDeps } from "./send-reminders";

const RIYADH = findCity("riyadh")!;
const MORNING: ReminderSettings = {
  city: RIYADH,
  time: { kind: "fixed", minutes: 7 * 60 + 30 },
  eveningNudge: true,
  ramadanMessage: true,
};
/** Day 3 after launch (page 3), 07:30 in Riyadh. */
const DAY3_MORNING = new Date("2026-10-25T04:30:00Z");
const CAPTION = "وِرد اليوم · الصفحة ٣\nسورة البقرة · الجزء ١\n";

const site = (status = 200): typeof fetch =>
  (async () => new Response(status === 200 ? CAPTION : "", { status })) as unknown as typeof fetch;

describe("sendDueReminders", () => {
  let store: MemoryReminderStore;
  let sent: { chatId: string; text: string; button?: string }[];
  let failNext: Error | null;
  let deps: ReminderDeps;

  beforeEach(async () => {
    store = new MemoryReminderStore();
    sent = [];
    failNext = null;
    deps = {
      store,
      telegram: {
        sendMessage: async (chatId, text, options) => {
          if (failNext) {
            const error = failNext;
            failNext = null;
            throw error;
          }
          sent.push({ chatId, text, button: options?.buttons?.[0]?.[0]?.callback_data });
        },
      },
      config: { enabled: true, dryRun: false, adminChatId: "999" },
      fetchImpl: site(),
    };
    await store.save(1, "101", MORNING, "2026-10-23");
  });

  it("sends the morning reminder with today's page, its surah and the read button", async () => {
    const result = await sendDueReminders(deps, DAY3_MORNING);
    expect(result).toMatchObject({ status: "done", sent: 1 });
    expect(sent).toEqual([
      { chatId: "101", text: "صفحة اليوم جاهزة: الصفحة ٣ من سورة البقرة.\n\nhttps://daydanquran.pages.dev/p/3", button: "read:3" },
    ]);
  });

  it("never sends twice when the run is repeated", async () => {
    await sendDueReminders(deps, DAY3_MORNING);
    await sendDueReminders(deps, new Date("2026-10-25T04:45:00Z"));
    expect(sent).toHaveLength(1);
  });

  it("re-checks the reading at send time", async () => {
    // The reader pressed «قرأت» between the list being read and the message being sent.
    const listActive = store.listActive.bind(store);
    store.listActive = async (from) => {
      const list = await listActive(from);
      store.readings.add("1 2026-10-25");
      return list;
    };
    expect(await sendDueReminders(deps, DAY3_MORNING)).toMatchObject({ sent: 0, alreadyDone: 1 });
    expect(sent).toHaveLength(0);
  });

  it("retries a failed send on the next run", async () => {
    failNext = new TelegramError("Telegram sendMessage: Too Many Requests", 429);
    expect(await sendDueReminders(deps, DAY3_MORNING)).toMatchObject({ sent: 0, failed: 1 });
    expect(await sendDueReminders(deps, new Date("2026-10-25T04:45:00Z"))).toMatchObject({ sent: 1 });
  });

  it("stops reminding a reader who blocked the bot", async () => {
    failNext = new TelegramError("Forbidden: bot was blocked by the user", 403);
    expect(await sendDueReminders(deps, DAY3_MORNING)).toMatchObject({ blocked: 1 });
    expect((await store.get(1))?.enabled).toBe(false);
  });

  it("in dry run, reminds only the admin", async () => {
    await store.save(2, "999", MORNING, "2026-10-23");
    const result = await sendDueReminders({ ...deps, config: { ...deps.config, dryRun: true } }, DAY3_MORNING);
    expect(result).toMatchObject({ sent: 1, dryRunSkipped: 1 });
    expect(sent.map((s) => s.chatId)).toEqual(["999"]);
  });

  it("does nothing when switched off, before launch, or when the page is not on the site", async () => {
    expect(await sendDueReminders({ ...deps, config: { ...deps.config, enabled: false } }, DAY3_MORNING)).toMatchObject({
      status: "skipped",
    });
    expect(await sendDueReminders(deps, new Date("2026-10-15T04:30:00Z"))).toEqual({ status: "skipped", reason: "before launch" });
    expect(await sendDueReminders({ ...deps, fetchImpl: site(404) }, DAY3_MORNING)).toMatchObject({ status: "skipped" });
    expect(sent).toHaveLength(0);
    expect(store.sends.size).toBe(0);
  });

  it("before launch, rehearses day one with the admin in dry run", async () => {
    await store.save(2, "999", MORNING, "2026-10-14");
    const dryRun = { ...deps, config: { ...deps.config, dryRun: true } };
    const result = await sendDueReminders(dryRun, new Date("2026-10-15T04:30:00Z"));
    expect(result).toMatchObject({ sent: 1, dryRunSkipped: 1 });
    expect(sent).toEqual([expect.objectContaining({ chatId: "999", button: "read:1" })]);
    expect(sent[0]?.text).toContain("https://daydanquran.pages.dev/p/1");
  });

  it("caps one run and leaves the rest to the next run", async () => {
    for (let id = 2; id <= MAX_SENDS_PER_RUN + 5; id++) await store.save(id, String(100 + id), MORNING, "2026-10-23");
    expect(await sendDueReminders(deps, DAY3_MORNING)).toMatchObject({ sent: MAX_SENDS_PER_RUN, deferred: 5 });
    expect(await sendDueReminders(deps, new Date("2026-10-25T04:45:00Z"))).toMatchObject({ sent: 5, deferred: 0 });
  });

  it("uses the after-prayer wording", async () => {
    await store.save(1, "101", { ...MORNING, time: { kind: "prayer", prayer: "fajr" } }, "2026-10-23");
    // Fajr in Riyadh in late October is around 04:45; the reminder follows 20 minutes later.
    await sendDueReminders(deps, new Date("2026-10-25T02:30:00Z")); // 05:30
    expect(sent[0]?.text).toMatch(/^بعد صلاة الفجر: وِردك اليوم صفحة واحدة\./);
  });
});

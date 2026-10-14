import { beforeEach, describe, expect, it } from "vitest";
import { LAUNCH_DATE, SITE_URL } from "@daydan/core";
import { memoryLedger } from "./fakes";
import { sendStoryKit, type StoryKitDeps } from "./story-kit";

const DAY = 24 * 3_600_000;
const LAUNCH_MORNING = new Date(`${LAUNCH_DATE}T04:01:00Z`);

interface Sent {
  chatId: string;
  fileName: string;
  bytes: number;
  caption?: string;
}

describe("sendStoryKit", () => {
  let sent: Sent[];
  let failures: number;
  let ledger: ReturnType<typeof memoryLedger>;
  let approved: number[];

  const deps = (enabled = true): StoryKitDeps => ({
    telegram: {
      sendDocument: async (chatId, file, fileName, options = {}) => {
        if (failures-- > 0) throw new Error("network");
        sent.push({ chatId, fileName, bytes: file.size, caption: options.caption });
      },
    },
    ledger,
    config: { enabled, adminChatId: "admin" },
    fetchImpl: (async (url: string) => {
      const match = url.match(/\/p\/(\d+)\/ig-story\.jpg$/);
      return match && approved.includes(Number(match[1])) ? new Response(new Uint8Array(1234)) : new Response("", { status: 404 });
    }) as typeof fetch,
    sleep: async () => {},
  });

  beforeEach(() => {
    sent = [];
    failures = 0;
    ledger = memoryLedger();
    approved = [1, 2];
  });

  it("sends today's story image, full size, to the admin with the page link", async () => {
    expect(await sendStoryKit(deps(), LAUNCH_MORNING)).toMatchObject({ status: "sent", page: 1 });
    expect(sent).toEqual([
      {
        chatId: "admin",
        fileName: "daydan-1.jpg",
        bytes: 1234,
        caption: `ستوري اليوم: الصفحة ١\nانشرها على إنستغرام وفيسبوك، وأضف ملصق الرابط:\n${SITE_URL}/p/1/`,
      },
    ]);
  });

  it("sends once per day", async () => {
    await sendStoryKit(deps(), LAUNCH_MORNING);
    expect((await sendStoryKit(deps(), new Date(LAUNCH_MORNING.getTime() + 3_600_000))).status).toBe("already");
    expect(sent).toHaveLength(1);
  });

  it("follows the schedule: the next day is the next page", async () => {
    expect(await sendStoryKit(deps(), new Date(LAUNCH_MORNING.getTime() + DAY))).toMatchObject({ status: "sent", page: 2 });
  });

  it("rehearses with page 1 before launch, marked as a test, every time it runs", async () => {
    const before = new Date(LAUNCH_MORNING.getTime() - 2 * DAY);
    await sendStoryKit(deps(), before);
    await sendStoryKit(deps(), before);
    expect(sent).toHaveLength(2);
    expect(sent[0]?.caption).toMatch(/^🧪 تجربة قبل الإطلاق، لا تنشرها\n/);
    expect(ledger.entries.size).toBe(0);
  });

  it("does nothing when switched off", async () => {
    expect((await sendStoryKit(deps(false), LAUNCH_MORNING)).status).toBe("skipped");
    expect(sent).toHaveLength(0);
  });

  it("refuses an unapproved page", async () => {
    approved = [];
    await expect(sendStoryKit(deps(), LAUNCH_MORNING)).rejects.toThrow("غير معتمدة");
    expect(sent).toHaveLength(0);
  });

  it("retries a failed send, and records nothing after three failures", async () => {
    failures = 2;
    expect((await sendStoryKit(deps(), LAUNCH_MORNING)).status).toBe("sent");

    ledger = memoryLedger();
    failures = 3;
    await expect(sendStoryKit(deps(), LAUNCH_MORNING)).rejects.toThrow("network");
    expect(ledger.entries.size).toBe(0);
  });
});

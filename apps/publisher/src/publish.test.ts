import { beforeEach, describe, expect, it } from "vitest";
import { LAUNCH_DATE } from "@daydan/core";
import { publishDaily, type PublishDeps } from "./publish";
import type { InlineButton } from "./telegram";

const LAUNCH_MORNING = new Date(`${LAUNCH_DATE}T04:00:00Z`);
const HOUR = 3_600_000;

const tafsirFiles = (count: number) =>
  Array.from({ length: count }, (_, i) => `tafsir-${String(i + 1).padStart(2, "0")}.png`);

function fakeSite(approved: boolean, tafsirCards = 2): typeof fetch {
  return (async (url: string) => {
    if (!approved) return new Response("", { status: 404 });
    if (url.endsWith("/cards.json")) {
      return Response.json({ mushaf: "mushaf.png", post: "post.png", story: "story.png", tafsir: tafsirFiles(tafsirCards) });
    }
    if (url.endsWith("/caption.txt")) return new Response("وِرد اليوم");
    return new Response("", { status: 404 });
  }) as typeof fetch;
}

function fakeKv(): PublishDeps["publications"] {
  const store = new Map<string, string>();
  return {
    get: (async (key: string) => store.get(key) ?? null) as PublishDeps["publications"]["get"],
    put: async (key: string, value: string) => void store.set(key, value),
  } as PublishDeps["publications"];
}

/** One sent Telegram message, reduced to what the tests check. */
interface Sent {
  chatId: string;
  files: string[];
  caption?: string;
  buttons?: InlineButton[][];
}

const fileName = (url: string) => url.split("/").pop()!;

describe("publishDaily", () => {
  let sent: Sent[];
  let failures: number;
  const fail = () => {
    if (failures-- > 0) throw new Error("network");
  };
  const deps = (overrides: Partial<PublishDeps["config"]> = {}, approved = true, tafsirCards = 2): PublishDeps => ({
    telegram: {
      sendPhoto: async (chatId, photo, options = {}) => {
        fail();
        sent.push({ chatId, files: [fileName(photo)], caption: options.caption, buttons: options.buttons });
      },
      sendMediaGroup: async (chatId, media) => {
        fail();
        sent.push({ chatId, files: media.map((m) => fileName(m.media)) });
      },
    },
    publications: fakeKv(),
    config: { enabled: true, dryRun: false, channel: "@channel", adminChatId: "admin", ...overrides },
    fetchImpl: fakeSite(approved, tafsirCards),
    sleep: async () => {},
  });

  beforeEach(() => {
    sent = [];
    failures = 0;
  });

  it("posts the designed page alone with the caption and read button, then the tafsir album", async () => {
    const result = await publishDaily(deps(), LAUNCH_MORNING);
    expect(result).toMatchObject({ status: "published", page: 1, messages: 2 });
    expect(sent.map((s) => s.files)).toEqual([["post.png"], ["tafsir-01.png", "tafsir-02.png"]]);
    expect(sent.every((s) => s.chatId === "@channel")).toBe(true);
    expect(sent[0]?.caption).toBe("وِرد اليوم");
    expect(sent[0]?.buttons).toEqual([[{ text: "قرأت الورد ✅", callback_data: "read:1" }]]);
  });

  it("never posts twice on the same day", async () => {
    const d = deps();
    await publishDaily(d, LAUNCH_MORNING);
    const again = await publishDaily(d, new Date(LAUNCH_MORNING.getTime() + HOUR));
    expect(again.status).toBe("skipped");
    expect(sent).toHaveLength(2);
  });

  it("dry run goes to the admin and does not block the real post", async () => {
    const d = deps({ dryRun: true });
    await publishDaily(d, LAUNCH_MORNING);
    await publishDaily(d, LAUNCH_MORNING);
    expect(sent).toHaveLength(4);
    expect(sent.every((s) => s.chatId === "admin")).toBe(true);
  });

  it("does nothing when the kill switch is off", async () => {
    expect((await publishDaily(deps({ enabled: false }), LAUNCH_MORNING)).status).toBe("skipped");
    expect(sent).toHaveLength(0);
  });

  it("does not post to the channel before launch day", async () => {
    expect((await publishDaily(deps(), new Date(LAUNCH_MORNING.getTime() - 24 * HOUR))).status).toBe("skipped");
    expect(sent).toHaveLength(0);
  });

  it("rehearses day one with the admin before launch in dry-run mode", async () => {
    const result = await publishDaily(deps({ dryRun: true }), new Date(LAUNCH_MORNING.getTime() - 24 * HOUR));
    expect(result).toMatchObject({ status: "published", page: 1, dryRun: true });
    expect(sent[0]?.chatId).toBe("admin");
  });

  it("refuses to publish an unapproved page", async () => {
    await expect(publishDaily(deps({}, false), LAUNCH_MORNING)).rejects.toThrow("غير معتمدة");
    expect(sent).toHaveLength(0);
  });

  it("retries a failed send, then succeeds", async () => {
    failures = 2;
    expect((await publishDaily(deps(), LAUNCH_MORNING)).status).toBe("published");
    expect(sent).toHaveLength(2);
  });

  it("gives up after three failed attempts and records nothing", async () => {
    failures = 3;
    const d = deps();
    await expect(publishDaily(d, LAUNCH_MORNING)).rejects.toThrow("network");
    expect((await publishDaily(d, LAUNCH_MORNING)).status).toBe("published");
  });

  it("splits more than ten tafsir cards into albums, sending a lone card as a photo", async () => {
    await publishDaily(deps({}, true, 11), LAUNCH_MORNING);
    expect(sent.map((s) => s.files.length)).toEqual([1, 10, 1]);
  });

  it("resumes after a failure without reposting what was already sent", async () => {
    const d = deps();
    const sendMediaGroup = d.telegram.sendMediaGroup;
    let albumCalls = 0;
    d.telegram.sendMediaGroup = async (chatId, media) => {
      if (++albumCalls <= 3) throw new Error("network"); // the album fails on every attempt
      return sendMediaGroup(chatId, media);
    };
    await expect(publishDaily(d, LAUNCH_MORNING)).rejects.toThrow("network");
    expect(sent.map((s) => s.files)).toEqual([["post.png"]]);

    await publishDaily(d, LAUNCH_MORNING);
    expect(sent.map((s) => s.files[0])).toEqual(["post.png", "tafsir-01.png"]);
  });
});

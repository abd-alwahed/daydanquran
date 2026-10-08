import { beforeEach, describe, expect, it } from "vitest";
import { LAUNCH_DATE } from "@daydan/core";
import { publishDaily, type PublishDeps } from "./publish";
import type { InputMediaPhoto } from "./telegram";

const LAUNCH_MORNING = new Date(`${LAUNCH_DATE}T04:00:00Z`);
const HOUR = 3_600_000;

function fakeSite(approved: boolean): typeof fetch {
  return (async (url: string) => {
    if (!approved) return new Response("", { status: 404 });
    if (url.endsWith("/cards.json")) return Response.json({ mushaf: "mushaf.png", tafsir: ["tafsir-01.png", "tafsir-02.png"] });
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

describe("publishDaily", () => {
  let sent: { chatId: string; media: InputMediaPhoto[] }[];
  let failures: number;
  const deps = (overrides: Partial<PublishDeps["config"]> = {}, approved = true): PublishDeps => ({
    telegram: {
      sendMediaGroup: async (chatId, media) => {
        if (failures-- > 0) throw new Error("network");
        sent.push({ chatId, media });
      },
    },
    publications: fakeKv(),
    config: { enabled: true, dryRun: false, channel: "@channel", adminChatId: "admin", ...overrides },
    fetchImpl: fakeSite(approved),
    sleep: async () => {},
  });

  beforeEach(() => {
    sent = [];
    failures = 0;
  });

  it("posts one album: the Mushaf page with the caption, then the tafsir cards", async () => {
    const result = await publishDaily(deps(), LAUNCH_MORNING);
    expect(result).toMatchObject({ status: "published", page: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.chatId).toBe("@channel");
    expect(sent[0]?.media.map((m) => m.media.split("/").pop())).toEqual(["mushaf.png", "tafsir-01.png", "tafsir-02.png"]);
    expect(sent[0]?.media[0]?.caption).toBe("وِرد اليوم");
  });

  it("never posts twice on the same day", async () => {
    const d = deps();
    await publishDaily(d, LAUNCH_MORNING);
    const again = await publishDaily(d, new Date(LAUNCH_MORNING.getTime() + HOUR));
    expect(again.status).toBe("skipped");
    expect(sent).toHaveLength(1);
  });

  it("dry run goes to the admin and does not block the real post", async () => {
    const d = deps({ dryRun: true });
    await publishDaily(d, LAUNCH_MORNING);
    await publishDaily(d, LAUNCH_MORNING);
    expect(sent.map((s) => s.chatId)).toEqual(["admin", "admin"]);
  });

  it("does nothing when the kill switch is off", async () => {
    expect((await publishDaily(deps({ enabled: false }), LAUNCH_MORNING)).status).toBe("skipped");
    expect(sent).toHaveLength(0);
  });

  it("does nothing before launch day", async () => {
    expect((await publishDaily(deps(), new Date(LAUNCH_MORNING.getTime() - 24 * HOUR))).status).toBe("skipped");
    expect(sent).toHaveLength(0);
  });

  it("refuses to publish an unapproved page", async () => {
    await expect(publishDaily(deps({}, false), LAUNCH_MORNING)).rejects.toThrow("غير معتمدة");
    expect(sent).toHaveLength(0);
  });

  it("retries a failed send, then succeeds", async () => {
    failures = 2;
    expect((await publishDaily(deps(), LAUNCH_MORNING)).status).toBe("published");
    expect(sent).toHaveLength(1);
  });

  it("gives up after three failed attempts and records nothing", async () => {
    failures = 3;
    const d = deps();
    await expect(publishDaily(d, LAUNCH_MORNING)).rejects.toThrow("network");
    failures = 0;
    expect((await publishDaily(d, LAUNCH_MORNING)).status).toBe("published");
  });
});

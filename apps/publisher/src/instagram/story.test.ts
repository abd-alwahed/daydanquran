import { beforeEach, describe, expect, it } from "vitest";
import { LAUNCH_DATE, SITE_URL } from "@daydan/core";
import { Instagram } from "./instagram";
import { fakeInstagramApi, memoryLedger } from "./fakes";
import { jpegSize, publishStory, type StoryDeps } from "./story";

const DAY = 24 * 3_600_000;
const LAUNCH_MORNING = new Date(`${LAUNCH_DATE}T04:01:00Z`);

/** SOI, a JFIF APP0 segment, a DQT segment, then SOF0 with the size. */
const jpeg = (width: number, height: number) =>
  new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, ...Array<number>(14).fill(0),
    0xff, 0xdb, 0x00, 0x04, 0x00, 0x01,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, ...Array<number>(12).fill(0),
  ]);

/** The site: only `approved` pages have their files. */
function fakeSite(approved: number[], size = { width: 1080, height: 1920 }) {
  const requests: string[] = [];
  const fetchImpl = (async (url: string) => {
    requests.push(url);
    const match = url.match(/\/p\/(\d+)\/ig-story\.jpg$/);
    return match && approved.includes(Number(match[1])) ? new Response(jpeg(size.width, size.height)) : new Response("", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, requests };
}

describe("jpegSize", () => {
  it("reads the size from the start-of-frame segment", async () => {
    expect(await jpegSize("https://x/a.jpg", (async () => new Response(jpeg(1080, 1920))) as typeof fetch)).toEqual({ width: 1080, height: 1920 });
  });

  it("rejects a PNG", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await expect(jpegSize("https://x/a.png", (async () => new Response(png)) as typeof fetch)).rejects.toThrow("ليست صورة JPEG");
  });
});

describe("publishStory", () => {
  let api: ReturnType<typeof fakeInstagramApi>;
  let site: ReturnType<typeof fakeSite>;
  let ledger: ReturnType<typeof memoryLedger>;
  let reports: string[];

  const deps = (config: Partial<StoryDeps["config"]> = {}): StoryDeps => ({
    instagram: new Instagram("t", "ig", api.fetchImpl, async () => {}),
    ledger,
    config: { enabled: true, dryRun: false, ...config },
    report: async (text) => reports.push(text),
    fetchImpl: site.fetchImpl,
    sleep: async () => {},
  });

  beforeEach(() => {
    api = fakeInstagramApi();
    site = fakeSite([1, 2]);
    ledger = memoryLedger();
    reports = [];
  });

  it("posts today's page as a story, once a day", async () => {
    expect(await publishStory(deps(), LAUNCH_MORNING)).toEqual({ status: "published", date: LAUNCH_DATE, page: 1 });
    expect(api.calls.find((c) => c.path === "ig/media")?.body).toEqual({ media_type: "STORIES", image_url: `${SITE_URL}/p/1/ig-story.jpg` });
    expect((await publishStory(deps(), new Date(LAUNCH_MORNING.getTime() + 3_600_000))).status).toBe("already");
    expect(api.publishes()).toBe(1);
  });

  it("posts the next page the next day", async () => {
    await publishStory(deps(), LAUNCH_MORNING);
    expect(await publishStory(deps(), new Date(LAUNCH_MORNING.getTime() + DAY))).toMatchObject({ status: "published", page: 2 });
  });

  it("checks the publishing limit first and stops when it is used up", async () => {
    api = fakeInstagramApi({ remaining: 0 });
    await expect(publishStory(deps(), LAUNCH_MORNING)).rejects.toThrow("content_publishing_limit");
    expect(api.calls.map((c) => c.path)).toEqual(["ig/content_publishing_limit?fields=config,quota_usage"]);
  });

  it("refuses an unapproved page", async () => {
    site = fakeSite([]);
    await expect(publishStory(deps(), LAUNCH_MORNING)).rejects.toThrow("غير معتمدة");
    expect(api.calls).toHaveLength(0);
  });

  it("refuses an image Instagram would crop", async () => {
    site = fakeSite([1], { width: 1080, height: 1350 });
    await expect(publishStory(deps(), LAUNCH_MORNING)).rejects.toThrow("٩:١٦");
    expect(api.calls).toHaveLength(0);
  });

  it("dry run checks the file, reports to the admin and calls no Instagram API", async () => {
    expect((await publishStory(deps({ dryRun: true }), LAUNCH_MORNING)).status).toBe("dry-run");
    expect(reports[0]).toContain("/p/1/ig-story.jpg");
    expect(api.calls).toHaveLength(0);
    expect(ledger.entries.size).toBe(0);
  });

  it("does nothing when the kill switch is off", async () => {
    expect((await publishStory(deps({ enabled: false }), LAUNCH_MORNING)).status).toBe("skipped");
    expect(site.requests).toHaveLength(0);
  });

  it("does not post before launch day, except as a dry run of page 1", async () => {
    const dayBefore = new Date(LAUNCH_MORNING.getTime() - DAY);
    expect((await publishStory(deps(), dayBefore)).status).toBe("skipped");
    expect(await publishStory(deps({ dryRun: true }), dayBefore)).toMatchObject({ status: "dry-run", page: 1 });
  });

  it("fails clearly when enabled without a token", async () => {
    await expect(publishStory({ ...deps(), instagram: undefined }, LAUNCH_MORNING)).rejects.toThrow("INSTAGRAM_ACCESS_TOKEN");
  });
});

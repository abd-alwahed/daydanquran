import { beforeEach, describe, expect, it } from "vitest";
import { LAUNCH_DATE } from "@daydan/core";
import { Facebook, Instagram, memoryLedger, type GraphClient, type GraphParams } from "@daydan/publishers";
import { publishMetaEvening, publishMetaMorning, publishMetaVideos, type MetaConfig, type MetaDeps } from "./publish-meta";

const DAY = 24 * 3_600_000;
const LAUNCH_MORNING = new Date(`${LAUNCH_DATE}T04:05:00Z`); // a Friday: not a reel day
const REEL_DAY_MORNING = new Date(LAUNCH_MORNING.getTime() + DAY); // Saturday

const png = (width: number, height: number) => {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
};

const jpeg = (width: number, height: number) =>
  new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, ...Array<number>(12).fill(0)]);

const tafsirFiles = (count: number) => Array.from({ length: count }, (_, i) => `tafsir-${String(i + 1).padStart(2, "0")}.png`);

interface SiteOptions {
  tafsirCards?: number;
  instagramCards?: boolean;
  videos?: boolean;
}

function fakeSite({ tafsirCards = 2, instagramCards = true, videos = true }: SiteOptions = {}) {
  const requests: string[] = [];
  const fetchImpl = (async (url: string) => {
    requests.push(url);
    const file = url.split("/").pop()!;
    if (file === "cards.json") return Response.json({ mushaf: "mushaf.png", post: "post.png", story: "story.png", tafsir: tafsirFiles(tafsirCards) });
    if (file === "caption.txt") return new Response("وِرد اليوم");
    if (file === "post.png") return new Response(png(1080, 1350));
    if (file === "reminder-story.jpg") return new Response(jpeg(1080, 1920));
    if (file === "ig-post.jpg") return new Response(jpeg(1080, 1350));
    // Without Instagram copies, imagine square PNGs served instead: wrong format and shape.
    if (/^ig-tafsir-\d+\.jpg$/.test(file)) return new Response(instagramCards ? jpeg(1080, 1350) : png(1080, 1080));
    if (/^tafsir-\d+\.png$/.test(file)) return new Response(png(1080, 1080));
    if (file.endsWith(".mp4") && videos) return new Response("");
    return new Response("", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, requests };
}

/** A fake Graph API: containers are ready at once, unless `reelPolls` says how many checks a reel needs. */
function fakeGraph(options: { remaining?: number; reelPolls?: number } = {}) {
  const calls: { method: string; path: string; params: GraphParams }[] = [];
  const status = new Map<string, string>();
  let reelPolls = options.reelPolls ?? 0;
  let next = 0;
  const graph: Pick<GraphClient, "get" | "post"> = {
    get: (async (path: string, params: GraphParams = {}) => {
      calls.push({ method: "GET", path, params });
      if (path.endsWith("/content_publishing_limit")) return { data: [{ config: { quota_total: 50 }, quota_usage: 50 - (options.remaining ?? 25) }] };
      if (status.get(path) === "REEL") return { status_code: reelPolls-- > 0 ? "IN_PROGRESS" : "FINISHED" };
      return { status_code: status.get(path) ?? "FINISHED" };
    }) as GraphClient["get"],
    post: (async (path: string, params: GraphParams) => {
      calls.push({ method: "POST", path, params });
      const id = `id${++next}`;
      if (path.endsWith("/media")) status.set(id, params.media_type === "REELS" ? "REEL" : "FINISHED");
      if (path.endsWith("/media_publish")) status.set(String(params.creation_id), "PUBLISHED");
      return { id };
    }) as GraphClient["post"],
  };
  const posts = (suffix: string) => calls.filter((c) => c.method === "POST" && c.path.endsWith(suffix));
  return { graph, calls, posts };
}

describe("Meta publishing", () => {
  let reports: string[];
  let graph: ReturnType<typeof fakeGraph>;
  let site: ReturnType<typeof fakeSite>;
  let ledger: ReturnType<typeof memoryLedger>;

  const deps = (config: Partial<MetaConfig> = {}): MetaDeps => ({
    instagram: new Instagram(graph.graph, "ig", async () => {}),
    facebook: new Facebook(graph.graph, "page"),
    ledger,
    config: { instagramEnabled: true, facebookEnabled: true, videoEnabled: false, dryRun: false, ...config },
    report: async (text) => reports.push(text),
    fetchImpl: site.fetchImpl,
    sleep: async () => {},
  });

  beforeEach(() => {
    reports = [];
    graph = fakeGraph();
    site = fakeSite();
    ledger = memoryLedger();
  });

  it("posts the page and the 4:5 tafsir cards as one Instagram carousel, and the originals on Facebook", async () => {
    const results = await publishMetaMorning(deps(), LAUNCH_MORNING);
    expect(results.map((r) => r.status)).toEqual(["published", "published"]);

    const items = graph.posts("ig/media").filter((c) => c.params.is_carousel_item).map((c) => String(c.params.image_url).split("/").pop());
    expect(items).toEqual(["ig-post.jpg", "ig-tafsir-01.jpg", "ig-tafsir-02.jpg"]);
    expect(graph.posts("ig/media").find((c) => c.params.media_type === "CAROUSEL")?.params.caption).toBe("وِرد اليوم");
    expect(graph.posts("ig/media_publish")).toHaveLength(1);

    const photos = graph.posts("page/photos").map((c) => String(c.params.url).split("/").pop());
    expect(photos).toEqual(["post.png", "tafsir-01.png", "tafsir-02.png"]);
    expect(graph.posts("page/feed")).toHaveLength(1);
  });

  it("never posts twice on the same day", async () => {
    await publishMetaMorning(deps(), LAUNCH_MORNING);
    const before = graph.calls.length;
    const again = await publishMetaMorning(deps(), new Date(LAUNCH_MORNING.getTime() + 3_600_000));
    expect(again.map((r) => r.status)).toEqual(["already", "already"]);
    expect(graph.calls).toHaveLength(before);
  });

  it("queries the publishing limit and skips Instagram when it is used up", async () => {
    graph = fakeGraph({ remaining: 0 });
    const [instagram, facebook] = await publishMetaMorning(deps(), LAUNCH_MORNING);
    expect(instagram).toMatchObject({ status: "over-quota" });
    expect(graph.calls.some((c) => c.path === "ig/content_publishing_limit")).toBe(true);
    expect(graph.posts("ig/media")).toHaveLength(0);
    expect(facebook?.status).toBe("published");
  });

  it("splits a page with many tafsir cards into balanced carousels within the limit", async () => {
    site = fakeSite({ tafsirCards: 11 });
    await publishMetaMorning(deps(), LAUNCH_MORNING);
    const carousels = graph.posts("ig/media").filter((c) => c.params.media_type === "CAROUSEL");
    expect(carousels.map((c) => String(c.params.children).split(",").length)).toEqual([6, 6]);
    expect(graph.posts("ig/media_publish")).toHaveLength(2);
  });

  it("refuses an Instagram post that Instagram would reject or crop, without holding back Facebook", async () => {
    site = fakeSite({ instagramCards: false });
    const results = await publishMetaMorning(deps(), LAUNCH_MORNING);
    expect(results.map((r) => r.status)).toEqual(["failed", "published"]);
    expect(results[0]?.detail).toContain("ig-tafsir-01.jpg");
    expect(graph.calls.filter((c) => c.path.startsWith("ig/"))).toHaveLength(0);
  });

  it("dry run checks the files, reports to the admin and calls no Meta API", async () => {
    const results = await publishMetaMorning(deps({ dryRun: true }), LAUNCH_MORNING);
    expect(results.map((r) => r.status)).toEqual(["dry-run", "dry-run"]);
    expect(reports).toHaveLength(2);
    expect(graph.calls).toHaveLength(0);
    expect(ledger.entries.size).toBe(0);
  });

  it("does nothing when the kill switches are off", async () => {
    const results = await publishMetaMorning(deps({ instagramEnabled: false, facebookEnabled: false }), LAUNCH_MORNING);
    expect(results.map((r) => r.status)).toEqual(["skipped", "skipped"]);
    expect(site.requests).toHaveLength(0);
  });

  it("does not post before launch day", async () => {
    const results = await publishMetaMorning(deps(), new Date(LAUNCH_MORNING.getTime() - DAY));
    expect(results.every((r) => r.status === "skipped")).toBe(true);
    expect(graph.calls).toHaveLength(0);
  });

  it("refuses an unapproved page", async () => {
    site.fetchImpl = (async () => new Response("", { status: 404 })) as typeof fetch;
    expect((await publishMetaMorning(deps(), LAUNCH_MORNING)).map((r) => r.status)).toEqual(["failed", "failed"]);
  });

  it("fails clearly when a channel is enabled without its token", async () => {
    const [instagram] = await publishMetaMorning({ ...deps(), instagram: undefined }, LAUNCH_MORNING);
    expect(instagram).toMatchObject({ status: "failed", detail: expect.stringContaining("META_ACCESS_TOKEN") });
  });

  describe("videos", () => {
    it("are off until META_VIDEO_ENABLED", async () => {
      const results = await publishMetaVideos(deps(), REEL_DAY_MORNING);
      expect(results.map((r) => r.status)).toEqual(["skipped", "skipped"]);
      expect(graph.calls).toHaveLength(0);
    });

    it("posts the page video on Facebook and a reel on reel days", async () => {
      const results = await publishMetaVideos(deps({ videoEnabled: true }), REEL_DAY_MORNING);
      expect(results.map((r) => r.status)).toEqual(["published", "published"]);
      expect(graph.posts("page/videos")[0]?.params.file_url).toMatch(/\/p\/2\/video\.mp4$/);
      expect(graph.posts("ig/media")[0]?.params).toMatchObject({ media_type: "REELS", video_url: expect.stringMatching(/\/p\/2\/reel\.mp4$/) });
    });

    it("posts no reel on other days", async () => {
      const [, reel] = await publishMetaVideos(deps({ videoEnabled: true }), LAUNCH_MORNING);
      expect(reel).toMatchObject({ status: "skipped", detail: "ليس يوم ريل" });
    });

    it("skips quietly when the page has no video yet", async () => {
      site = fakeSite({ videos: false });
      const results = await publishMetaVideos(deps({ videoEnabled: true }), REEL_DAY_MORNING);
      expect(results.map((r) => r.status)).toEqual(["skipped", "skipped"]);
    });

    it("keeps a reel that is still processing and finishes it in the evening run", async () => {
      graph = fakeGraph({ reelPolls: 100 });
      const [, reel] = await publishMetaVideos(deps({ videoEnabled: true }), REEL_DAY_MORNING);
      expect(reel?.status).toBe("pending");

      graph.calls.length = 0;
      const evening = await publishMetaEvening(deps(), new Date(REEL_DAY_MORNING.getTime() + 13 * 3_600_000));
      expect(evening.map((r) => r.status)).toEqual(["published", "pending"]);
    });
  });

  describe("evening story", () => {
    it("posts the reminder story once", async () => {
      const evening = new Date(`${LAUNCH_DATE}T17:00:00Z`);
      const [story, reel] = await publishMetaEvening(deps(), evening);
      expect(story?.status).toBe("published");
      expect(reel?.status).toBe("skipped");
      expect(graph.posts("ig/media")[0]?.params).toMatchObject({ media_type: "STORIES", image_url: expect.stringMatching(/reminder-story\.jpg$/) });
      expect((await publishMetaEvening(deps(), evening))[0]?.status).toBe("already");
      expect(graph.posts("ig/media_publish")).toHaveLength(1);
    });
  });
});

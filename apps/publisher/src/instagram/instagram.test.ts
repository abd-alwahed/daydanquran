import { describe, expect, it } from "vitest";
import { fakeInstagramApi, memoryLedger } from "./fakes";
import { Instagram, InstagramError, publishOnce } from "./instagram";

const POLL = { intervalMs: 0, maxPolls: 3 };
const noSleep = async () => {};

describe("Instagram", () => {
  it("sends the token in a header, never in the URL", async () => {
    const api = fakeInstagramApi();
    await new Instagram("SECRET", "ig", api.fetchImpl).createStory("https://x/ig-story.jpg");
    expect(api.calls[0]).toMatchObject({ method: "POST", path: "ig/media", auth: "Bearer SECRET" });
    expect(api.calls[0]?.body).toEqual({ media_type: "STORIES", image_url: "https://x/ig-story.jpg" });
    expect(api.calls.some((c) => c.path.includes("SECRET"))).toBe(false);
  });

  it("reads the remaining quota from content_publishing_limit", async () => {
    const api = fakeInstagramApi({ remaining: 7 });
    expect(await new Instagram("t", "ig", api.fetchImpl).remainingQuota()).toBe(7);
    expect(api.calls[0]?.path).toBe("ig/content_publishing_limit?fields=config,quota_usage");
  });

  it("refuses to guess when the limit is missing", async () => {
    const fetchImpl = (async () => Response.json({ data: [] })) as typeof fetch;
    await expect(new Instagram("t", "ig", fetchImpl).remainingQuota()).rejects.toThrow("بلا قيم");
  });

  it("turns an API error into InstagramError", async () => {
    const fetchImpl = (async () => Response.json({ error: { message: "Invalid OAuth access token", code: 190 } }, { status: 400 })) as typeof fetch;
    const error = await new Instagram("t", "ig", fetchImpl).status("c1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InstagramError);
    expect((error as InstagramError).message).toBe("Instagram GET c1: Invalid OAuth access token");
  });

  it("polls until FINISHED and gives up after the allowed polls", async () => {
    const api = fakeInstagramApi({ statuses: ["IN_PROGRESS", "IN_PROGRESS", "IN_PROGRESS"] });
    const ig = new Instagram("t", "ig", api.fetchImpl, noSleep);
    const id = await ig.createStory("https://x/s.jpg");
    await expect(ig.waitUntilReady(id, POLL)).rejects.toThrow("قيد المعالجة");
    expect(await ig.waitUntilReady(id, POLL)).toBe("FINISHED");
  });
});

describe("publishOnce", () => {
  const story = (ig: Instagram) => () => ig.createStory("https://x/s.jpg");

  it("publishes once and records it", async () => {
    const api = fakeInstagramApi();
    const ig = new Instagram("t", "ig", api.fetchImpl, noSleep);
    const ledger = memoryLedger();
    expect(await publishOnce(ig, ledger, "k", story(ig), POLL, noSleep)).toBe("published");
    expect(await publishOnce(ig, ledger, "k", story(ig), POLL, noSleep)).toBe("already");
    expect(api.publishes()).toBe(1);
  });

  it("does not publish again when a publish landed but its answer was lost", async () => {
    const api = fakeInstagramApi({ failPublish: 1, publishLands: true });
    const ig = new Instagram("t", "ig", api.fetchImpl, noSleep);
    expect(await publishOnce(ig, memoryLedger(), "k", story(ig), POLL, noSleep)).toBe("published");
    expect(api.publishes()).toBe(1);
  });

  it("recognises a lost publish on the next run from the stored container", async () => {
    const api = fakeInstagramApi({ failPublish: 3 });
    const ig = new Instagram("t", "ig", api.fetchImpl, noSleep);
    const ledger = memoryLedger();
    await expect(publishOnce(ig, ledger, "k", story(ig), POLL, noSleep)).rejects.toThrow("timeout");
    expect(await ledger.get("k:container")).toBe("c1");

    api.containers.set("c1", "PUBLISHED"); // Instagram published it after all
    expect(await publishOnce(ig, ledger, "k", story(ig), POLL, noSleep)).toBe("published");
    expect(api.publishes()).toBe(3);
  });

  it("replaces an expired container", async () => {
    const api = fakeInstagramApi();
    const ig = new Instagram("t", "ig", api.fetchImpl, noSleep);
    const ledger = memoryLedger();
    await ledger.put("k:container", "old");
    api.containers.set("old", "EXPIRED");
    expect(await publishOnce(ig, ledger, "k", story(ig), POLL, noSleep)).toBe("published");
    expect(api.calls.find((c) => c.path === "ig/media_publish")?.body.creation_id).toBe("c1");
  });
});

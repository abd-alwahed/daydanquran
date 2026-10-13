import { describe, expect, it } from "vitest";
import { GraphError, type GraphClient, type GraphParams } from "./graph";
import { ContainerNotReadyError, Instagram, publishOnce, splitIntoCarousels, type ContainerStatus } from "./instagram";
import { memoryLedger } from "./ledger";

const POLL = { intervalMs: 0, maxPolls: 3 };
const noSleep = async () => {};

/** A fake Graph API that tracks containers the way Instagram does. */
function fakeGraph(options: { quota?: unknown; statuses?: ContainerStatus[]; failPublish?: number; publishLandsAnyway?: boolean } = {}) {
  const calls: { method: string; path: string; params: GraphParams }[] = [];
  const containers = new Map<string, ContainerStatus>();
  const pending = [...(options.statuses ?? [])];
  let failPublish = options.failPublish ?? 0;
  let next = 0;
  const graph: Pick<GraphClient, "get" | "post"> = {
    get: (async (path: string, params: GraphParams = {}) => {
      calls.push({ method: "GET", path, params });
      if (path.endsWith("/content_publishing_limit")) return options.quota ?? { data: [{ config: { quota_total: 50 }, quota_usage: 3 }] };
      const current = containers.get(path)!;
      const code = current === "IN_PROGRESS" ? (pending.shift() ?? "FINISHED") : current;
      containers.set(path, code);
      return { status_code: code };
    }) as GraphClient["get"],
    post: (async (path: string, params: GraphParams) => {
      calls.push({ method: "POST", path, params });
      if (path.endsWith("/media")) {
        const id = `c${++next}`;
        containers.set(id, "IN_PROGRESS");
        return { id };
      }
      // media_publish
      const id = String(params.creation_id);
      if (failPublish-- > 0) {
        if (options.publishLandsAnyway) containers.set(id, "PUBLISHED");
        throw new Error("timeout");
      }
      containers.set(id, "PUBLISHED");
      return { id: `m-${id}` };
    }) as GraphClient["post"],
  };
  return { graph, calls, containers, publishes: () => calls.filter((c) => c.path.endsWith("/media_publish")).length };
}

describe("splitIntoCarousels", () => {
  it("keeps up to ten items in one carousel", () => {
    expect(splitIntoCarousels([1, 2, 3])).toEqual([[1, 2, 3]]);
    expect(splitIntoCarousels(Array.from({ length: 10 }, (_, i) => i))).toHaveLength(1);
  });

  it("balances eleven items as 6 + 5 so no carousel has a single item", () => {
    expect(splitIntoCarousels(Array.from({ length: 11 }, (_, i) => i)).map((c) => c.length)).toEqual([6, 5]);
  });

  it("keeps the order", () => {
    expect(splitIntoCarousels(Array.from({ length: 21 }, (_, i) => i)).flat()).toEqual(Array.from({ length: 21 }, (_, i) => i));
  });
});

describe("Instagram", () => {
  it("reads the remaining quota from content_publishing_limit", async () => {
    const { graph, calls } = fakeGraph();
    expect(await new Instagram(graph, "ig").remainingQuota()).toBe(47);
    expect(calls[0]).toMatchObject({ path: "ig/content_publishing_limit", params: { fields: "config,quota_usage" } });
  });

  it("refuses to guess when the limit is missing from the answer", async () => {
    const { graph } = fakeGraph({ quota: { data: [] } });
    await expect(new Instagram(graph, "ig").remainingQuota()).rejects.toThrow("بلا قيم");
  });

  it("refuses a carousel above the item limit", () => {
    const { graph } = fakeGraph();
    expect(() => new Instagram(graph, "ig").createCarousel(Array.from({ length: 11 }, String), "")).toThrow("٢–10");
  });

  it("polls until FINISHED, then gives up after the allowed polls", async () => {
    const { graph } = fakeGraph({ statuses: ["IN_PROGRESS", "IN_PROGRESS", "IN_PROGRESS"] });
    const ig = new Instagram(graph, "ig", noSleep);
    const id = await ig.createReel("https://x/reel.mp4", "");
    await expect(ig.waitUntilReady(id, POLL)).rejects.toBeInstanceOf(ContainerNotReadyError);
    expect(await ig.waitUntilReady(id, POLL)).toBe("FINISHED");
  });

  it("fails on a container in ERROR", async () => {
    const { graph } = fakeGraph({ statuses: ["ERROR"] });
    const ig = new Instagram(graph, "ig", noSleep);
    await expect(ig.waitUntilReady(await ig.createStory("https://x/s.png"), POLL)).rejects.toThrow("ERROR");
  });
});

describe("publishOnce", () => {
  const story = (ig: Instagram) => () => ig.createStory("https://x/s.png");

  it("publishes once and records it", async () => {
    const { graph, publishes } = fakeGraph();
    const ig = new Instagram(graph, "ig", noSleep);
    const ledger = memoryLedger();
    expect(await publishOnce(ig, ledger, "k", POLL, story(ig), noSleep)).toBe("published");
    expect(await publishOnce(ig, ledger, "k", POLL, story(ig), noSleep)).toBe("already");
    expect(publishes()).toBe(1);
  });

  it("does not publish again when an earlier publish landed but its answer was lost", async () => {
    const { graph, publishes } = fakeGraph({ failPublish: 1, publishLandsAnyway: true });
    const ig = new Instagram(graph, "ig", noSleep);
    expect(await publishOnce(ig, memoryLedger(), "k", POLL, story(ig), noSleep)).toBe("published");
    expect(publishes()).toBe(1);
  });

  it("recognises a lost publish on the next run from the stored container", async () => {
    const { graph, containers, publishes } = fakeGraph({ failPublish: 3 });
    const ig = new Instagram(graph, "ig", noSleep);
    const ledger = memoryLedger();
    await expect(publishOnce(ig, ledger, "k", POLL, story(ig), noSleep)).rejects.toThrow("timeout");
    expect(await ledger.get("k:container")).toBe("c1");

    containers.set("c1", "PUBLISHED"); // Meta published it after all
    expect(await publishOnce(ig, ledger, "k", POLL, story(ig), noSleep)).toBe("published");
    expect(publishes()).toBe(3);
  });

  it("resumes a stored container instead of creating a new one", async () => {
    const { graph, calls } = fakeGraph({ statuses: ["IN_PROGRESS", "IN_PROGRESS", "IN_PROGRESS"] });
    const ig = new Instagram(graph, "ig", noSleep);
    const ledger = memoryLedger();
    const reel = () => ig.createReel("https://x/r.mp4", "");
    await expect(publishOnce(ig, ledger, "reel", POLL, reel, noSleep)).rejects.toBeInstanceOf(ContainerNotReadyError);
    // A later run without `create` (the evening run) finishes it.
    expect(await publishOnce(ig, ledger, "reel", POLL, undefined, noSleep)).toBe("published");
    expect(calls.filter((c) => c.path === "ig/media")).toHaveLength(1);
  });

  it("has nothing to resume without a stored container", async () => {
    const { graph } = fakeGraph();
    expect(await publishOnce(new Instagram(graph, "ig"), memoryLedger(), "reel", POLL)).toBe("nothing-to-resume");
  });

  it("replaces an expired container", async () => {
    const { graph, containers, calls } = fakeGraph();
    const ig = new Instagram(graph, "ig", noSleep);
    const ledger = memoryLedger();
    await ledger.put("k:container", "old");
    containers.set("old", "EXPIRED");
    expect(await publishOnce(ig, ledger, "k", POLL, story(ig), noSleep)).toBe("published");
    expect(calls.find((c) => c.path === "ig/media_publish")?.params.creation_id).toBe("c1");
  });

  it("surfaces Graph errors", async () => {
    const graph: Pick<GraphClient, "get" | "post"> = {
      get: (async () => ({})) as GraphClient["get"],
      post: (async () => {
        throw new GraphError("Graph POST ig/media: bad", 100, false);
      }) as GraphClient["post"],
    };
    const ig = new Instagram(graph, "ig");
    await expect(publishOnce(ig, memoryLedger(), "k", POLL, story(ig), noSleep)).rejects.toThrow("bad");
  });
});

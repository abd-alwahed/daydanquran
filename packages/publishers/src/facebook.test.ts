import { describe, expect, it } from "vitest";
import { Facebook, UncertainPostError, postOnce } from "./facebook";
import { GraphError, type GraphClient, type GraphParams } from "./graph";
import { memoryLedger } from "./ledger";

const noSleep = async () => {};

function fakeGraph() {
  const calls: { path: string; params: GraphParams; host?: string }[] = [];
  const graph: Pick<GraphClient, "post"> = {
    post: (async (path: string, params: GraphParams, host?: string) => {
      calls.push({ path, params, host });
      return { id: `id${calls.length}` };
    }) as GraphClient["post"],
  };
  return { graph, calls };
}

describe("Facebook", () => {
  it("uploads hidden photos, then attaches them to one post in order", async () => {
    const { graph, calls } = fakeGraph();
    const fb = new Facebook(graph, "page");
    const ids = [await fb.uploadHiddenPhoto("https://x/post.png"), await fb.uploadHiddenPhoto("https://x/tafsir-01.png")];
    await fb.postPhotos("وِرد اليوم", ids);
    expect(calls[0]).toEqual({ path: "page/photos", params: { url: "https://x/post.png", published: false }, host: undefined });
    expect(calls[2]?.params).toEqual({
      message: "وِرد اليوم",
      "attached_media[0]": '{"media_fbid":"id1"}',
      "attached_media[1]": '{"media_fbid":"id2"}',
    });
  });

  it("posts a video by URL on the video host", async () => {
    const { graph, calls } = fakeGraph();
    await new Facebook(graph, "page").postVideo("https://x/video.mp4", "نص");
    expect(calls[0]).toMatchObject({ path: "page/videos", params: { file_url: "https://x/video.mp4" }, host: "https://graph-video.facebook.com" });
  });
});

describe("postOnce", () => {
  it("posts once per key", async () => {
    const ledger = memoryLedger();
    let posts = 0;
    const post = async () => `p${++posts}`;
    expect(await postOnce(ledger, "k", post, noSleep)).toBe("published");
    expect(await postOnce(ledger, "k", post, noSleep)).toBe("already");
    expect(posts).toBe(1);
    expect(await ledger.get("k:pending")).toBeNull();
  });

  it("retries when Meta answered with an error (nothing was posted)", async () => {
    let attempts = 0;
    const post = async () => {
      if (++attempts < 3) throw new GraphError("busy", 2, true);
      return "p";
    };
    expect(await postOnce(memoryLedger(), "k", post, noSleep)).toBe("published");
    expect(attempts).toBe(3);
  });

  it("clears the pending mark after three refusals so the next run may try again", async () => {
    const ledger = memoryLedger();
    const post = async (): Promise<string> => {
      throw new GraphError("bad", 100, false);
    };
    await expect(postOnce(ledger, "k", post, noSleep)).rejects.toThrow("bad");
    expect(await ledger.get("k:pending")).toBeNull();
  });

  it("never reposts after an answer was lost: the outcome is unknown", async () => {
    const ledger = memoryLedger();
    let posts = 0;
    const lost = async (): Promise<string> => {
      posts++;
      throw new Error("network");
    };
    await expect(postOnce(ledger, "k", lost, noSleep)).rejects.toThrow("network");
    await expect(postOnce(ledger, "k", async () => `p${++posts}`, noSleep)).rejects.toBeInstanceOf(UncertainPostError);
    expect(posts).toBe(1);
  });
});

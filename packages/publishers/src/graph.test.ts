import { describe, expect, it } from "vitest";
import { GRAPH_VERSION, GraphClient, GraphError } from "./graph";
import { imageSize, sameAspect } from "./image-size";

describe("GraphClient", () => {
  it("sends the token in a header and never in the URL", async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const graph = new GraphClient("SECRET", (async (url: string, init?: RequestInit) => {
      seen = { url, init };
      return Response.json({ id: "1" });
    }) as typeof fetch);
    await graph.post("ig/media", { image_url: "https://x/a.png", is_carousel_item: true });
    expect(seen?.url).toBe(`https://graph.facebook.com/${GRAPH_VERSION}/ig/media`);
    expect(seen?.url).not.toContain("SECRET");
    expect(new Headers(seen?.init?.headers).get("authorization")).toBe("Bearer SECRET");
    expect(String(seen?.init?.body)).toBe("image_url=https%3A%2F%2Fx%2Fa.png&is_carousel_item=true");
  });

  it("turns a Graph error into GraphError without the token", async () => {
    const graph = new GraphClient("SECRET", (async () =>
      Response.json({ error: { message: "Invalid OAuth access token", code: 190 } }, { status: 400 })) as typeof fetch);
    const error = await graph.get("ig", { fields: "id" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GraphError);
    expect((error as GraphError).code).toBe(190);
    expect((error as GraphError).message).toBe("Graph GET ig: Invalid OAuth access token");
  });
});

const png = (width: number, height: number) => {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
};

/** SOI, a JFIF APP0 segment, a DQT segment, then SOF0 with the size. */
const jpeg = (width: number, height: number) => {
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...Array<number>(14).fill(0)];
  const dqt = [0xff, 0xdb, 0x00, 0x04, 0x00, 0x01];
  const sof0 = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, ...Array<number>(12).fill(0)];
  return new Uint8Array([0xff, 0xd8, ...app0, ...dqt, ...sof0]);
};

const serve = (bytes: Uint8Array<ArrayBuffer>) => (async () => new Response(bytes)) as typeof fetch;

describe("imageSize", () => {
  it("reads a PNG's size from its header", async () => {
    expect(await imageSize("https://x/post.png", serve(png(1080, 1350)))).toEqual({ format: "png", width: 1080, height: 1350 });
  });

  it("reads a JPEG's size from its start-of-frame segment", async () => {
    expect(await imageSize("https://x/ig-post.jpg", serve(jpeg(1080, 1350)))).toEqual({ format: "jpeg", width: 1080, height: 1350 });
  });

  it("rejects anything else", async () => {
    await expect(imageSize("https://x/a.gif", serve(new TextEncoder().encode("GIF89a")))).rejects.toThrow("PNG أو JPEG");
  });

  it("fails for a missing file", async () => {
    await expect(imageSize("https://x/a.png", (async () => new Response("", { status: 404 })) as typeof fetch)).rejects.toThrow("404");
  });

  it("compares aspect ratios exactly", () => {
    expect(sameAspect({ width: 1080, height: 1350 }, { width: 864, height: 1080 })).toBe(true);
    expect(sameAspect({ width: 1080, height: 1350 }, { width: 1080, height: 1080 })).toBe(false);
  });
});

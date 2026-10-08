import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildManifest, buildReport, freezePage } from "./freeze";

let root: string;
let build: string;
let release: string;

const cards = { mushaf: "mushaf.png", post: "post.png", story: "story.png", tafsir: ["tafsir-01.png", "tafsir-02.png"] };

async function writeBuild(overrides: Record<string, string> = {}) {
  const files: Record<string, string> = {
    "page.json": "{}",
    "cards.json": JSON.stringify(cards),
    "caption.txt": "caption",
    "mushaf.png": "m",
    "post.png": "p",
    "story.png": "s",
    "tafsir-01.png": "t1",
    "tafsir-02.png": "t2",
    "draft.png": "not in cards.json",
    ...overrides,
  };
  await fs.mkdir(build, { recursive: true });
  for (const [name, data] of Object.entries(files)) await fs.writeFile(path.join(build, name), data);
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "daydan-freeze-"));
  build = path.join(root, "build", "7");
  release = path.join(root, "v1");
});
afterEach(() => fs.rm(root, { recursive: true, force: true }));

describe("freezePage", () => {
  it("copies exactly the files cards.json lists, plus page.json, cards.json and caption.txt", async () => {
    await writeBuild();
    expect(await freezePage(build, path.join(release, "7"))).toBe(8);
    expect((await fs.readdir(path.join(release, "7"))).sort()).toEqual(
      ["caption.txt", "cards.json", "mushaf.png", "page.json", "post.png", "story.png", "tafsir-01.png", "tafsir-02.png"].sort(),
    );
  });

  it("is a no-op when re-run on the same build", async () => {
    await writeBuild();
    await freezePage(build, path.join(release, "7"));
    expect(await freezePage(build, path.join(release, "7"))).toBe(0);
  });

  it("refuses to change a frozen file", async () => {
    await writeBuild();
    await freezePage(build, path.join(release, "7"));
    await writeBuild({ "post.png": "changed" });
    await expect(freezePage(build, path.join(release, "7"))).rejects.toThrow(/new release/);
    expect(await fs.readFile(path.join(release, "7", "post.png"), "utf8")).toBe("p");
  });

  it("refuses when the build dropped a frozen file", async () => {
    await writeBuild();
    await freezePage(build, path.join(release, "7"));
    await writeBuild({ "cards.json": JSON.stringify({ ...cards, tafsir: ["tafsir-01.png"] }) });
    await expect(freezePage(build, path.join(release, "7"))).rejects.toThrow(/new release/);
  });
});

describe("buildManifest", () => {
  it("hashes every frozen file and reports per page", async () => {
    await writeBuild();
    await freezePage(build, path.join(release, "7"));
    await fs.writeFile(path.join(release, "manifest.json"), "{}");

    const manifest = await buildManifest(release);
    expect(manifest.release).toBe("v1");
    expect(manifest.pages).toEqual([7]);
    expect(Object.keys(manifest.files)).toHaveLength(8);
    expect(manifest.files["7/post.png"]).toEqual({ sha256: createHash("sha256").update("p").digest("hex"), bytes: 1 });

    const report = buildReport(manifest);
    expect(report.byPage[7]!.tafsirCards).toBe(2);
    expect(report.maxTafsirCards).toEqual({ page: 7, cards: 2 });
    expect(report.totalBytes).toBe(Object.values(manifest.files).reduce((s, f) => s + f.bytes, 0));
  });
});

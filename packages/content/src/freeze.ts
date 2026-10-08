import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { PageCards } from "@daydan/core";
import { CONTENT_DIR } from "./paths";

/** The frozen release. Frozen files are never changed: any later edit is a new release (v2). docs/04 §8 */
export const RELEASE = "v1";
export const RELEASE_DIR = path.join(CONTENT_DIR, RELEASE);
export const MANIFEST_FILE = "manifest.json";
export const RELEASE_REPORT_FILE = "report.json";

export interface ManifestEntry {
  sha256: string;
  bytes: number;
}

export interface Manifest {
  release: string;
  pages: number[];
  /** Keyed by `<page>/<file>`, the same path as in the release dir and in R2 under `<release>/`. */
  files: Record<string, ManifestEntry>;
}

export interface ReleaseReport {
  release: string;
  pages: number;
  totalBytes: number;
  maxTafsirCards: { page: number; cards: number };
  byPage: Record<number, { tafsirCards: number; bytes: number }>;
}

/** The files of one built page that go into the release, in order. */
export async function pageFiles(buildDir: string): Promise<string[]> {
  const cards = JSON.parse(await fs.readFile(path.join(buildDir, "cards.json"), "utf8")) as PageCards;
  return ["page.json", "cards.json", "caption.txt", cards.mushaf, cards.post, cards.story, ...cards.tafsir];
}

/**
 * Copies one built page into the release. Re-running with the same files is a no-op; a file that
 * differs from its frozen copy, or a frozen file the build no longer has, throws.
 * Returns the number of files written.
 */
export async function freezePage(buildDir: string, releaseDir: string): Promise<number> {
  const files = await pageFiles(buildDir);
  await fs.mkdir(releaseDir, { recursive: true });
  const stale = (await fs.readdir(releaseDir)).filter((f) => !files.includes(f));
  if (stale.length) throw new Error(`${releaseDir}: frozen files not in the build: ${stale.join(", ")}. Changes need a new release.`);

  let written = 0;
  for (const file of files) {
    const data = await fs.readFile(path.join(buildDir, file));
    const target = path.join(releaseDir, file);
    const frozen = await fs.readFile(target).catch(() => undefined);
    if (frozen) {
      if (!frozen.equals(data)) throw new Error(`${target} is frozen and the build differs. Changes need a new release.`);
      continue;
    }
    await fs.writeFile(target, data);
    written++;
  }
  return written;
}

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");

/** Hashes every file of every page in the release. */
export async function buildManifest(releaseDir: string): Promise<Manifest> {
  const pages = (await fs.readdir(releaseDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
    .map((d) => Number(d.name))
    .sort((a, b) => a - b);
  const files: Record<string, ManifestEntry> = {};
  for (const page of pages) {
    for (const file of await pageFiles(path.join(releaseDir, String(page)))) {
      const data = await fs.readFile(path.join(releaseDir, String(page), file));
      files[`${page}/${file}`] = { sha256: sha256(data), bytes: data.length };
    }
  }
  return { release: path.basename(releaseDir), pages, files };
}

export function buildReport(manifest: Manifest): ReleaseReport {
  const byPage: ReleaseReport["byPage"] = {};
  for (const page of manifest.pages) byPage[page] = { tafsirCards: 0, bytes: 0 };
  for (const [key, { bytes }] of Object.entries(manifest.files)) {
    const [page, file] = key.split("/") as [string, string];
    const entry = byPage[Number(page)]!;
    entry.bytes += bytes;
    if (/^tafsir-\d+\.png$/.test(file)) entry.tafsirCards++;
  }
  let max = { page: 0, cards: 0 };
  for (const [page, { tafsirCards }] of Object.entries(byPage)) {
    if (tafsirCards > max.cards) max = { page: Number(page), cards: tafsirCards };
  }
  return {
    release: manifest.release,
    pages: manifest.pages.length,
    totalBytes: Object.values(byPage).reduce((sum, p) => sum + p.bytes, 0),
    maxTafsirCards: max,
    byPage,
  };
}

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PUBLIC_PAGES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/p");
export const PUBLISHED_INDEX_FILE = path.join(PUBLIC_PAGES_DIR, "index.json");

/** Written by scripts/sync-content.ts. The site builds exactly these pages. */
export interface PublishedIndex {
  pages: number[];
  /** True for a local review build, which must never be deployed. */
  preview: boolean;
}

let cached: Promise<PublishedIndex> | undefined;

export function readPublishedIndex(): Promise<PublishedIndex> {
  cached ??= fs
    .readFile(PUBLISHED_INDEX_FILE, "utf8")
    .then((raw) => JSON.parse(raw) as PublishedIndex)
    .catch(() => {
      throw new Error("public/p/index.json missing: run `pnpm sync-content` before building");
    });
  return cached;
}

export const readPublishedPages = async (): Promise<number[]> => (await readPublishedIndex()).pages;

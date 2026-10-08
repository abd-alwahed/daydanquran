import fs from "node:fs/promises";
import path from "node:path";
import type { PageCards, PageData } from "@daydan/core";
import { APPROVED_FILE, pageDir } from "./paths";

const readJson = async <T>(file: string): Promise<T> => JSON.parse(await fs.readFile(file, "utf8")) as T;

export const readPage = (page: number): Promise<PageData> => readJson(path.join(pageDir(page), "page.json"));

export const readCards = (page: number): Promise<PageCards> => readJson(path.join(pageDir(page), "cards.json"));

interface ApprovedFile {
  pages: number[];
}

/**
 * Pages a human has reviewed and approved, ascending.
 * Only these are built into the site, so only these can ever be published.
 */
export async function readApprovedPages(): Promise<number[]> {
  const { pages } = await readJson<ApprovedFile>(APPROVED_FILE);
  return [...new Set(pages)].sort((a, b) => a - b);
}

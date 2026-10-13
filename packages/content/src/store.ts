import fs from "node:fs/promises";
import path from "node:path";
import { TOTAL_PAGES, type PageCards, type PageData } from "@daydan/core";
import { APPROVED_FILE, PAGES_DIR, pageDir } from "./paths";
import { reviewFlags } from "./review-flags";

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
export async function readApprovedPages(file: string = APPROVED_FILE): Promise<number[]> {
  const { pages } = await readJson<ApprovedFile>(file);
  return [...new Set(pages)].sort((a, b) => a - b);
}

/** Pages whose media has been rendered (they have cards.json), ascending. */
export async function readBuiltPages(): Promise<number[]> {
  const dirs = await fs.readdir(PAGES_DIR).catch(() => [] as string[]);
  const pages: number[] = [];
  for (const dir of dirs) {
    const hasCards = await fs.access(path.join(PAGES_DIR, dir, "cards.json")).then(() => true, () => false);
    if (hasCards) pages.push(Number(dir));
  }
  return pages.sort((a, b) => a - b);
}

const assertPage = (page: number) => {
  if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) throw new Error(`رقم صفحة غير صالح: ${page}`);
};

/** Every built page that needs a closer look, with the reasons (see reviewFlags). */
export async function readFlaggedPages(): Promise<Map<number, string[]>> {
  const flagged = new Map<number, string[]>();
  for (const page of await readBuiltPages()) {
    const [data, cards] = await Promise.all([readPage(page), readCards(page)]);
    const flags = reviewFlags(data, cards.tafsir.length);
    if (flags.length) flagged.set(page, flags);
  }
  return flagged;
}

/** The approved list with `changed` (one page or several) added or removed, deduplicated and ascending. */
export function withApproval(pages: readonly number[], changed: number | readonly number[], approved: boolean): number[] {
  const list = typeof changed === "number" ? [changed] : changed;
  list.forEach(assertPage);
  const set = new Set(pages);
  for (const page of list) {
    if (approved) set.add(page);
    else set.delete(page);
  }
  return [...set].sort((a, b) => a - b);
}

/** Pages `from` to `to` inclusive. Throws on a reversed or out-of-mushaf range. */
export function pageRange(from: number, to: number): number[] {
  assertPage(from);
  assertPage(to);
  if (from > to) throw new Error(`النطاق مقلوب: من ${from} إلى ${to}`);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/**
 * The review queue: the first built page after `after` that is not approved yet, in reading order.
 * Skipped pages stay unapproved and come back on the next pass (`after` = 0).
 */
export function nextToReview(built: readonly number[], approved: readonly number[], after = 0): number | undefined {
  const done = new Set(approved);
  return built.find((page) => page > after && !done.has(page));
}

/** Records a human's review decision in content/approved.json, keeping the file's other fields. */
export async function setPageApproval(
  changed: number | readonly number[],
  approved: boolean,
  file: string = APPROVED_FILE,
): Promise<number[]> {
  const current = await readJson<ApprovedFile & Record<string, unknown>>(file);
  const pages = withApproval(current.pages, changed, approved);
  // Keep the page list on one line so the file stays readable as it grows to 604 entries.
  const body = JSON.stringify({ ...current, pages: "@pages" }, null, 2).replace('"@pages"', `[${pages.join(", ")}]`);
  await fs.writeFile(file, `${body}\n`);
  return pages;
}

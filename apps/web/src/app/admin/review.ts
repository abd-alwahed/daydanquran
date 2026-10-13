import fs from "node:fs/promises";
import path from "node:path";
import type { PageCards, PageData } from "@daydan/core";
import { pageDir, readApprovedPages, readCards, readPage, reviewFlags } from "@daydan/content";

export interface PageReview {
  data: PageData;
  cards: PageCards;
  caption: string;
  approved: boolean;
  /** Why this page needs a closer look; empty for an ordinary page. */
  flags: string[];
}

/** Everything the renderer produced for one page, read straight from content/build. */
export async function readReview(page: number): Promise<PageReview> {
  const [data, cards, caption, approved] = await Promise.all([
    readPage(page),
    readCards(page),
    fs.readFile(path.join(pageDir(page), "caption.txt"), "utf8"),
    readApprovedPages(),
  ]);
  return { data, cards, caption, approved: approved.includes(page), flags: reviewFlags(data, cards.tafsir.length) };
}

/** The review queue, continuing after `after` (0 = from the first page); `flagged` = unusual pages only. */
export function queueUrl(after = 0, flagged = false): string {
  const query = new URLSearchParams();
  if (after) query.set("after", String(after));
  if (flagged) query.set("flagged", "1");
  return `/admin/review/${query.size ? `?${query}` : ""}`;
}

/** URL of a generated file, served by ./files (no trailing slash: it names a file). */
export const fileUrl = (page: number, file: string): string => `/admin/files/${page}/${file}`;

/** The shared caption without its hashtag line, which means nothing in WhatsApp. */
export const whatsappText = (caption: string): string =>
  caption
    .split("\n")
    .filter((line) => !line.startsWith("#"))
    .join("\n")
    .trim();

import fs from "node:fs/promises";
import path from "node:path";
import type { PageCards, PageData } from "@daydan/core";
import { pageDir, readApprovedPages, readCards, readPage } from "@daydan/content";

export interface PageReview {
  data: PageData;
  cards: PageCards;
  caption: string;
  approved: boolean;
}

/** Everything the renderer produced for one page, read straight from content/build. */
export async function readReview(page: number): Promise<PageReview> {
  const [data, cards, caption, approved] = await Promise.all([
    readPage(page),
    readCards(page),
    fs.readFile(path.join(pageDir(page), "caption.txt"), "utf8"),
    readApprovedPages(),
  ]);
  return { data, cards, caption, approved: approved.includes(page) };
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

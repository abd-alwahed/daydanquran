/**
 * Decides which Mushaf pages the site publishes and copies their media into public/p/<n>/.
 * This is the one place where the approval gate is enforced:
 *   - normal build: only pages listed in content/approved.json;
 *   - `--preview`: every built page, for local review. Such a build is marked and
 *     scripts/deploy.ts refuses to deploy it.
 * The Telegram publisher fetches these files by URL, so an unpublished page cannot be posted.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { LAUNCH_DATE, TOTAL_PAGES, todaysPage } from "@daydan/core";
import { PAGES_DIR, pageDir, readApprovedPages } from "@daydan/content";
import { PUBLIC_PAGES_DIR, PUBLISHED_INDEX_FILE, type PublishedIndex } from "../src/lib/published-pages";

const PUBLISHED_FILE = /^(mushaf|post|story|tafsir-\d+)\.png$|^cards\.json$|^caption\.txt$/;
/** Warn when fewer than this many upcoming days are approved. */
const RUNWAY_DAYS = 7;

async function builtPages(): Promise<number[]> {
  const dirs = await fs.readdir(PAGES_DIR).catch(() => [] as string[]);
  const pages: number[] = [];
  for (const dir of dirs) {
    const hasCards = await fs.access(path.join(PAGES_DIR, dir, "cards.json")).then(() => true, () => false);
    if (hasCards) pages.push(Number(dir));
  }
  return pages.sort((a, b) => a - b);
}

async function copyPage(page: number): Promise<void> {
  const from = pageDir(page);
  const to = path.join(PUBLIC_PAGES_DIR, String(page));
  await fs.mkdir(to, { recursive: true });
  const files = (await fs.readdir(from)).filter((f) => PUBLISHED_FILE.test(f));
  if (!files.includes("cards.json")) throw new Error(`الصفحة ${page} معتمدة لكن صورها لم تُولَّد بعد`);
  await Promise.all(files.map((f) => fs.copyFile(path.join(from, f), path.join(to, f))));
}

function warnIfRunwayIsShort(pages: readonly number[]): void {
  const today = todaysPage(LAUNCH_DATE, new Date())?.page ?? 1;
  const published = new Set(pages);
  const upcoming = Array.from({ length: RUNWAY_DAYS }, (_, i) => ((today - 1 + i) % TOTAL_PAGES) + 1);
  const missing = upcoming.filter((p) => !published.has(p));
  if (missing.length) console.warn(`⚠️  صفحات الأيام القادمة غير معتمدة بعد: ${missing.join(", ")}`);
}

async function main(): Promise<void> {
  const preview = process.argv.includes("--preview");
  const pages = preview ? await builtPages() : await readApprovedPages();
  if (pages.length === 0) {
    throw new Error("لا توجد صفحات معتمدة. أضف رقم صفحة واحدة على الأقل إلى content/approved.json بعد مراجعتها.");
  }

  await fs.rm(PUBLIC_PAGES_DIR, { recursive: true, force: true });
  for (const page of pages) await copyPage(page);
  const index: PublishedIndex = { pages, preview };
  await fs.writeFile(PUBLISHED_INDEX_FILE, JSON.stringify(index));

  console.log(`✅ ${pages.length} صفحة${preview ? " (معاينة: كل الصفحات المولّدة، لا تُنشر)" : " معتمدة"} في public/p`);
  if (!preview) warnIfRunwayIsShort(pages);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

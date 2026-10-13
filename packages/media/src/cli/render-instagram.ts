/**
 * Writes the Instagram copies (JPEG, 4:5) of already rendered pages (ig-post.jpg, ig-tafsir-NN.jpg), without
 * re-rendering anything else. `render` makes them too; this fills them in for older pages.
 *   pnpm --filter @daydan/media render:instagram 1 604
 */
import fs from "node:fs/promises";
import path from "node:path";
import { TOTAL_PAGES, type PageCards } from "@daydan/core";
import { pageDir } from "@daydan/content";
import { launchBrowser } from "../browser";
import { renderInstagramCards } from "../render-page";

async function main(): Promise<void> {
  const [from = 1, to = from] = process.argv.slice(2).map(Number);
  if (!(from >= 1 && to <= TOTAL_PAGES && from <= to)) throw new Error("Usage: render:instagram <from> [to]");

  const browser = await launchBrowser();
  let done = 0;
  try {
    for (let page = from; page <= to; page++) {
      const dir = pageDir(page);
      const cards = await fs.readFile(path.join(dir, "cards.json"), "utf8").catch(() => null);
      if (!cards) continue; // not rendered yet
      await renderInstagramCards(browser, dir, JSON.parse(cards) as PageCards);
      // The first run of this script wrote PNG copies, which Instagram does not accept.
      for (const f of await fs.readdir(dir)) if (/^ig-tafsir-\d+\.png$/.test(f)) await fs.rm(path.join(dir, f));
      process.stdout.write(`\r${++done}`);
    }
  } finally {
    await browser.close();
  }
  console.log(`\n✅ ${done} صفحة`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

/**
 * Writes Instagram's JPEG copy of the story (ig-story.jpg) for pages already rendered, without
 * re-rendering anything else. `render` writes it too; this fills it in for older pages.
 *   pnpm --filter @daydan/media render:instagram 1 604
 */
import fs from "node:fs/promises";
import path from "node:path";
import { TOTAL_PAGES } from "@daydan/core";
import { pageDir } from "@daydan/content";
import { launchBrowser } from "../browser";
import { renderInstagramStory } from "../render-page";

async function main(): Promise<void> {
  const [from = 1, to = from] = process.argv.slice(2).map(Number);
  if (!(from >= 1 && to <= TOTAL_PAGES && from <= to)) throw new Error("Usage: render:instagram <from> [to]");

  const browser = await launchBrowser();
  let done = 0;
  try {
    for (let page = from; page <= to; page++) {
      const dir = pageDir(page);
      if (!(await fs.stat(path.join(dir, "story.png")).catch(() => null))) continue; // not rendered yet
      await renderInstagramStory(browser, dir);
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

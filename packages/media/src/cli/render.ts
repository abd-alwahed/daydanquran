/**
 * Renders post, story, tafsir cards, caption and cards.json for a range of pages.
 *   pnpm --filter @daydan/media render 1 604
 *   pnpm --filter @daydan/media render 1 604 --workers 4
 */
import { TOTAL_PAGES } from "@daydan/core";
import { pageDir, readPage } from "@daydan/content";
import { launchBrowser } from "../browser";
import { renderPage } from "../render-page";

function parseArgs(argv: string[]) {
  const workersFlag = argv.indexOf("--workers");
  const workers = workersFlag >= 0 ? Number(argv[workersFlag + 1]) : 1;
  const [from = 1, to = from] = argv.filter((a, i) => !a.startsWith("--") && (workersFlag < 0 || i !== workersFlag + 1)).map(Number);
  if (!(from >= 1 && to <= TOTAL_PAGES && from <= to && workers >= 1)) throw new Error("Usage: render <from> [to] [--workers n]");
  return { from, to, workers };
}

async function main(): Promise<void> {
  const { from, to, workers } = parseArgs(process.argv.slice(2));
  const queue = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const total = queue.length;
  let done = 0;

  const browser = await launchBrowser();
  try {
    // Each worker takes the next page off the shared queue; pages are independent.
    await Promise.all(
      Array.from({ length: workers }, async () => {
        for (let page = queue.shift(); page !== undefined; page = queue.shift()) {
          await renderPage(browser, await readPage(page), pageDir(page));
          process.stdout.write(`\r${++done}/${total}`);
        }
      }),
    );
  } finally {
    await browser.close();
  }
  console.log(`\n✅ ${total} صفحة`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

/**
 * Renders the evening reminder story into the site's public files (committed: it changes only
 * when its template does).
 *   pnpm --filter @daydan/media render:reminder
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "../browser";
import { renderReminderStory } from "../render-page";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../apps/web/public/reminder-story.png");

async function main(): Promise<void> {
  const browser = await launchBrowser();
  try {
    await renderReminderStory(browser, OUT);
  } finally {
    await browser.close();
  }
  console.log(`✅ ${path.relative(process.cwd(), OUT)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

/**
 * Renders the evening reminder story into the site's public files (committed: it changes only
 * when its template does).
 *   pnpm --filter @daydan/media render:reminder
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "../browser";
import { renderReminderStory, renderReminderStoryJpeg } from "../render-page";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../apps/web/public/reminder-story.png");
/** The same story as JPEG: the only image format Instagram's publishing API accepts. */
const OUT_JPEG = OUT.replace(/\.png$/, ".jpg");

async function main(): Promise<void> {
  const browser = await launchBrowser();
  try {
    await renderReminderStory(browser, OUT);
    await renderReminderStoryJpeg(browser, OUT, OUT_JPEG);
  } finally {
    await browser.close();
  }
  console.log(`✅ ${path.relative(process.cwd(), OUT)}, ${path.basename(OUT_JPEG)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

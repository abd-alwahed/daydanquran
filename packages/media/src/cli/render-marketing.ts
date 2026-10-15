/**
 * Renders the Instagram/Facebook plan into one folder per posting date, with the day's images,
 * caption.txt (the post text alone) and notes.txt (the day's schedule), plus the calendar README.md.
 *   pnpm --filter @daydan/media render:marketing
 * Output: marketing/launch-2026/<date>/. Fails if any text falls back to another font or runs outside
 * its canvas.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Canvas, launchBrowser } from "../browser";
import { canvasSize, type Asset } from "../marketing/assets";
import { entryFiles, planDays } from "../marketing/folders";
import { PLAN, QUOTES_TO_REVIEW, arabicDay as day, type Entry } from "../marketing/plan";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = path.join(ROOT, "marketing/launch-2026");
/** The same images on the site, so Buffer can fetch them by URL (buffer:sync). Not committed. */
const WEB = path.join(ROOT, "apps/web/public/marketing");

function calendar(): string {
  const entry = (e: Entry) =>
    [
      `### ${day(e.date)} · ${e.time} · ${e.kind}: ${e.title}`,
      "",
      `المجلد: [${e.date}](${e.date}/)`,
      "",
      ...entryFiles(e).map((f) => `- [${f.name}](${e.date}/${f.name})`),
      ...(e.caption ? ["", "النص:", "", "```text", e.caption, "```"] : []),
      ...(e.note ? ["", ...e.note.split("\n").map((l) => `> ${l}  `)] : []),
      "",
    ].join("\n");
  return [
    "# خطة إنستغرام وفيسبوك: ١٦ أكتوبر – ٢١ نوفمبر ٢٠٢٦",
    "",
    "مولَّدة من `packages/media/src/marketing/plan.ts` بالأمر `pnpm --filter @daydan/media render:marketing`. عدّل هناك ثم أعد التوليد، لا هنا.",
    "",
    "لكل يوم نشر مجلد باسم تاريخه: صوره بالترتيب، و`caption.txt` نص المنشور جاهزاً للنسخ، و`notes.txt` مواعيد اليوم وملاحظاته.",
    "",
    "المنصّتان للتسويق فقط: لا تُنشر صفحة المصحف ولا التفسير كمنشورات. الأوقات بتوقيت مكة، والمنشور نفسه على المنصّتين.",
    "",
    "## كل يوم من ٢٣ أكتوبر",
    "",
    "- ٠٧:٠١ ستوري صفحة اليوم: تصلك على تيليجرام، شاركها مع ملصق رابط الموقع.",
    "- ٢٠:٠٠ ستوري التذكير: [reminder-story.png](../../apps/web/public/reminder-story.png).",
    "",
    "## قبل النشر",
    "",
    `- الاقتباسات (${QUOTES_TO_REVIEW.map(day).join("؛ ")}) يراجع المراجع الشرعي نصها وتخريجها قبل نشرها.`,
    "- في إنستغرام الرابط في النص لا يُضغط: الرابط في النبذة وفي ملصق الستوري. في فيسبوك يعمل كما هو.",
    "",
    "## التقويم",
    "",
    ...PLAN.map(entry),
  ].join("\n");
}

/** Renders each distinct image once into `dir`, named by its asset file. */
async function render(assets: Asset[], dir: string): Promise<void> {
  const browser = await launchBrowser();
  try {
    for (const asset of assets) {
      const canvas = await Canvas.open(browser, canvasSize(asset.html));
      try {
        await canvas.load(asset.html);
        const overflow = await canvas.overflowingText();
        if (overflow.length > 0)
          throw new Error(`${asset.file}: text outside the canvas: ${overflow.join(" | ")}`);
        await canvas.screenshot(path.join(dir, asset.file));
        console.log(`✅ ${asset.file}`);
      } finally {
        await canvas.close();
      }
    }
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const assets = [...new Map(PLAN.flatMap((e) => e.assets).map((a) => [a.file, a])).values()];
  const rendered = path.join(OUT, ".rendered");
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(rendered, { recursive: true });
  await render(assets, rendered);

  const days = planDays(PLAN);
  await fs.rm(WEB, { recursive: true, force: true });
  for (const d of days) {
    const dir = path.join(OUT, d.date);
    await fs.mkdir(dir);
    await fs.mkdir(path.join(WEB, d.date), { recursive: true });
    for (const f of d.files) {
      const source = "asset" in f ? path.join(rendered, f.asset.file) : path.join(ROOT, f.existing);
      await fs.copyFile(source, path.join(dir, f.name));
      await fs.copyFile(source, path.join(WEB, d.date, f.name));
    }
    if (d.caption) await fs.writeFile(path.join(dir, "caption.txt"), `${d.caption}\n`);
    await fs.writeFile(path.join(dir, "notes.txt"), `${d.notes}\n`);
  }
  await fs.rm(rendered, { recursive: true });
  await fs.writeFile(path.join(OUT, "README.md"), calendar());
  console.log(`${assets.length} images in ${days.length} day folders → ${path.relative(process.cwd(), OUT)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

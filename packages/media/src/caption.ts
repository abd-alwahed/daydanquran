import { SITE_URL, juzLabel, surahLabel, toArabicDigits, type PageData } from "@daydan/core";

/** The shared post text (handoff/docs/04-content-pipeline.md). */
export function caption(data: PageData): string {
  return [
    `وِرد اليوم · الصفحة ${toArabicDigits(data.page)}`,
    `سورة ${surahLabel(data)} · الجزء ${juzLabel(data)}`,
    "",
    "اقرأ واستمع مع التفسير الميسر:",
    `${SITE_URL}/p/${data.page}`,
    "",
    "#ديدن #ورد_اليوم #القرآن_الكريم",
  ].join("\n");
}

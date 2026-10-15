import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toArabicDigits } from "@daydan/core";
import { escapeHtml } from "../template";

/** The brand's design templates (docs/06-brand.md), filled here for the marketing images. */
const TEMPLATES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../handoff/templates-html",
);

const cache = new Map<string, string>();
const template = (name: string): string => {
  if (!cache.has(name)) cache.set(name, fs.readFileSync(path.join(TEMPLATES_DIR, `${name}.html`), "utf8"));
  return cache.get(name)!;
};

/** One image to render: its file name and the full HTML of its canvas. */
export interface Asset {
  file: string;
  html: string;
}

/** Replaces `from` with `to`, which must occur exactly `times` times, so a changed template fails loudly. */
export function edit(html: string, from: string, to: string, times = 1): string {
  const count = html.split(from).length - 1;
  if (count !== times) throw new Error(`"${from.slice(0, 60)}" appears ${count} times, expected ${times}`);
  return html.split(from).join(to);
}

/** A template placeholder left unfilled, such as "[عنوان الإعلان]". */
export const leftoverPlaceholder = (html: string): string | undefined => /\[[^\]<>"]{1,80}\]/.exec(html)?.[0];

const text = (value: string) => escapeHtml(value).replace(/\n/g, "<br>");
const n = (value: number) => toArabicDigits(value);

/** Square announcement (1080×1080). */
export const postAnnounce = (file: string, a: { tag?: string; title: string; body: string }): Asset => {
  let html = template("PostAnnounce");
  if (a.tag) html = edit(html, ">إعلان</div>", `>${text(a.tag)}</div>`);
  html = edit(html, "[عنوان الإعلان في سطر أو سطرين]", text(a.title));
  html = edit(html, "[جملة توضيحية قصيرة تشرح التفاصيل]", text(a.body));
  return { file, html };
};

/** Story announcement (1080×1920). */
export const storyAnnounce = (
  file: string,
  a: { tag: string; title: string; body: string; action: string },
): Asset => {
  let html = template("StoryAnnounce");
  html = edit(html, ">إعلان</div>", `>${text(a.tag)}</div>`);
  html = edit(html, "[عنوان الإعلان]", text(a.title));
  html = edit(html, "[التفاصيل في سطر أو سطرين]", text(a.body));
  html = edit(html, "[نص الدعوة للفعل]", text(a.action));
  return { file, html };
};

/** Countdown story: `days` before launch, 1 = tomorrow. */
export const storyCountdown = (file: string, days: 1 | 2 | 3): Asset => {
  let html = template("StoryCountdown");
  if (days === 1) {
    html = edit(html, ">نبدأ بعد</div>", ">نبدأ</div>");
    html = edit(
      html,
      'font-size: 360px; line-height: 1; color: #2E6475">[٣]',
      'font-size: 240px; line-height: 1.3; color: #2E6475">غداً',
    );
    html = edit(html, ">أيام</div>", ">الجمعة ٧ صباحاً بتوقيت مكة</div>");
    html = edit(html, 'font-size: 72px; color: #1F3A44">الجمعة', 'font-size: 52px; color: #1F3A44">الجمعة');
  } else {
    html = edit(html, "[٣]", n(days));
    if (days === 2) html = edit(html, ">أيام</div>", ">يومين</div>");
  }
  return { file, html };
};

/** Quote post. The four hadiths in the plan were checked by the owner (2026-10-15). */
export const postQuote = (file: string, quote: string, source: string): Asset => {
  let html = template("PostQuote");
  html = edit(html, "«أحبُّ الأعمالِ إلى الله أدومُها وإن قلّ»", `«${text(quote)}»`);
  html = edit(html, "[المصدر: متفق عليه]", text(source));
  return { file, html };
};

/** Friday post with the pages read together since launch, up to yesterday. */
export const postFriday = (file: string, pagesRead: number): Asset => {
  const unit = pagesRead >= 3 && pagesRead <= 10 ? "صفحات" : "صفحة";
  let html = edit(template("PostFriday"), "[٧] صفحات", `${n(pagesRead)} ${unit}`);
  html = edit(html, "قرأنا هذا الأسبوع", "قرأنا معاً حتى الآن");
  return { file, html };
};

/** Juz milestone: the 30-bar khatma meter with the juz just completed in gold (docs/06-brand.md). */
export const postMilestone = (file: string, juz: number): Asset => {
  const bar = (color: string) =>
    `<div style="flex: 1; height: 40px; border-radius: 10px; background: ${color}"></div>`;
  const bars = Array.from({ length: 30 }, (_, i) =>
    bar(i + 1 < juz ? "#2E6475" : i + 1 === juz ? "#B8924A" : "#DEE6E9"),
  ).join("");
  let html = template("PostMilestone");
  html = html.replace(
    /(<div style="display: flex; gap: 6px">)(?:<div style="flex: 1;[^>]*><\/div>){30}/,
    `$1${bars}`,
  );
  if (!html.includes(bars)) throw new Error("PostMilestone: khatma meter not found");
  html = edit(html, "الجزء [١٣]", `الجزء ${n(juz)}`);
  html = edit(html, "[١٣] من ٣٠", `${n(juz)} من ٣٠`);
  return { file, html };
};

export interface Carousel {
  tag: string;
  title: string;
  subtitle: string;
  slides: { title: string; body: string }[];
}

/** Multi-image post: cover, one slide per point, and the closing card. Files: `<prefix>-1.png` … */
export const carousel = (prefix: string, c: Carousel): Asset[] => {
  let cover = template("CarouselCover");
  cover = edit(cover, "[التصنيف]", text(c.tag));
  cover = edit(cover, "[عنوان السلسلة]", text(c.title));
  cover = edit(cover, "[وصف من سطر واحد]", text(c.subtitle));
  const slides = c.slides.map((s, i) => {
    let html = template("CarouselSlide");
    html = edit(html, "[١]", n(i + 1));
    html = edit(html, "[٢] / [٥]", `${n(i + 1)} / ${n(c.slides.length)}`);
    html = edit(html, "[عنوان النقطة]", text(s.title));
    html = edit(html, "[شرح النقطة في جملتين أو ثلاث، بلغة سهلة وقصيرة.]", text(s.body));
    return html;
  });
  return [cover, ...slides, template("CarouselEnd")].map((html, i) => ({
    file: `${prefix}-${i + 1}.png`,
    html,
  }));
};

/** Facebook cover (1640×624), as designed. */
export const facebookCover = (file: string): Asset => ({ file, html: template("Cover") });

/** The five Instagram highlight covers, each 1080×1080 with its icon centered, from the Highlights sheet. */
export const highlightCovers = (prefix: string): Asset[] => {
  const sheet = template("Highlights");
  const icons = [...sheet.matchAll(/box-shadow: [^"]*"><svg width="\d+" height="\d+"([\s\S]*?<\/svg>)/g)].map(
    (m) => m[1]!,
  );
  if (icons.length !== 5) throw new Error(`Highlights: expected 5 icons, found ${icons.length}`);
  return icons.map((icon, i) => ({
    file: `${prefix}-${i + 1}.png`,
    html:
      '<!doctype html><html lang="ar"><head><meta charset="utf-8"><style>body{margin:0}</style></head><body>' +
      '<div dir="rtl" style="width: 1080px; height: 1080px; background: #2E6475; display: flex; align-items: center; justify-content: center">' +
      `<svg width="480" height="480"${icon}</div></body></html>`,
  }));
};

/** Canvas size from the template's root `<div dir="rtl" style="… width: Npx; height: Npx …">`. */
export function canvasSize(html: string): { width: number; height: number } {
  const style = /<div dir="rtl" style="([^"]*)"/.exec(html)?.[1] ?? "";
  const width = Number(/width:\s*(\d+)px/.exec(style)?.[1]);
  const height = Number(/height:\s*(\d+)px/.exec(style)?.[1]);
  if (!width || !height) throw new Error("Canvas size not found");
  return { width, height };
}

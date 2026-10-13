import fs from "node:fs/promises";
import path from "node:path";
import type { Browser } from "playwright";
import { juzLabel, surahLabel, tafsirUnits, toArabicDigits, type PageCards, type PageData } from "@daydan/core";
import { Canvas, type Size } from "./browser";
import { caption } from "./caption";
import { packTafsirCards, type Card, type CardPiece } from "./tafsir-cards";
import { escapeHtml, fill, loadTemplate } from "./template";

const POST: Size = { width: 1080, height: 1350 };
const STORY: Size = { width: 1080, height: 1920 };
const SQUARE: Size = { width: 1080, height: 1080 };
/**
 * Sanity cap: the Mushaf page plus the cards must fit in two Telegram albums of 10.
 * The longest page today (597, al-'Alaq) needs 10 cards.
 */
export const MAX_TAFSIR_CARDS = 19;

// Tafsir.html's text box, adjusted: clipped so overflow can be measured, and 36px (the brand minimum
// for post text, docs/06-brand.md) instead of 40px so most pages fit in 3–4 cards.
const TAFSIR_BOX = [
  "flex-grow: 1; font-family: 'Scheherazade New', serif; font-size: 40px; line-height: 2;",
  "flex-grow: 1; min-height: 0; overflow: hidden; font-family: 'Scheherazade New', serif; font-size: 36px; line-height: 1.9;",
] as const;
const TAFSIR_BOX_ID = "tafsir";
const TAFSIR_PLACEHOLDER = /\[نص التفسير الميسر[^\]]*\]/;

const pieceHtml = (p: CardPiece) =>
  (p.isFirst ? `<span style="color:#2E6475;font-weight:600">(${p.label})</span> ` : "") +
  (p.isPointer ? `<span style="color:#4B6169">${escapeHtml(p.text)}</span>` : escapeHtml(p.text));

const cardHtml = (pieces: readonly CardPiece[]) =>
  pieces.map((p, i) => (i === 0 ? "" : pieces[i - 1]!.unit !== p.unit ? "<br>" : " ") + pieceHtml(p)).join("");

async function mushafDataUrl(dir: string): Promise<string> {
  return `data:image/png;base64,${(await fs.readFile(path.join(dir, "mushaf.png"))).toString("base64")}`;
}

/** Fills a Mushaf-page template (post or story) and writes it as `file`. */
async function renderMushafTemplate(browser: Browser, data: PageData, dir: string, template: string, size: Size, file: string) {
  let html = await loadTemplate(template);
  html = fill(html, "{{MUSHAF}}", await mushafDataUrl(dir));
  html = fill(html, "{{PAGE}}", toArabicDigits(data.page));
  html = fill(html, "{{SURAH}}", surahLabel(data));
  html = fill(html, "{{JUZ}}", juzLabel(data));
  const canvas = await Canvas.open(browser, size);
  try {
    await canvas.load(html);
    await canvas.screenshot(path.join(dir, file));
  } finally {
    await canvas.close();
  }
}

async function layoutTafsir(browser: Browser, data: PageData): Promise<Card[]> {
  const template = await loadTemplate("Tafsir.html");
  const probe = template
    .replace(...TAFSIR_BOX)
    .replace(TAFSIR_PLACEHOLDER, "")
    .replace(`<div style="${TAFSIR_BOX[1]}`, `<div id="${TAFSIR_BOX_ID}" style="${TAFSIR_BOX[1]}`);
  const canvas = await Canvas.open(browser, SQUARE);
  try {
    await canvas.load(probe);
    return await packTafsirCards(tafsirUnits(data), (pieces) => canvas.contentFits(TAFSIR_BOX_ID, cardHtml(pieces)));
  } finally {
    await canvas.close();
  }
}

async function renderTafsirCards(browser: Browser, data: PageData, dir: string): Promise<string[]> {
  const cards = await layoutTafsir(browser, data);
  if (cards.length > MAX_TAFSIR_CARDS) throw new Error(`Page ${data.page}: ${cards.length} tafsir cards, max ${MAX_TAFSIR_CARDS}`);

  const template = (await loadTemplate("Tafsir.html")).replace(...TAFSIR_BOX);
  const names = new Map(data.surahs.map((s) => [s.id, s.name]));
  const canvas = await Canvas.open(browser, SQUARE);
  const files: string[] = [];
  try {
    for (const [i, card] of cards.entries()) {
      const first = card[0]!;
      const last = card.at(-1)!;
      const label = first.from === last.to ? `الآية ${toArabicDigits(first.from)}` : `الآيات ${toArabicDigits(first.from)}–${toArabicDigits(last.to)}`;
      let html = fill(template, "الآية [رقم]", label);
      html = fill(html, "١ / [عدد البطاقات]", `${toArabicDigits(i + 1)} / ${toArabicDigits(cards.length)}`);
      html = html.replace(TAFSIR_PLACEHOLDER, cardHtml(card));
      html = fill(html, "الصفحة [رقم] · سورة [اسم السورة]", `الصفحة ${toArabicDigits(data.page)} · سورة ${names.get(first.surah)}`);
      await canvas.load(html);
      const file = `tafsir-${String(i + 1).padStart(2, "0")}.png`;
      await canvas.screenshot(path.join(dir, file));
      files.push(file);
    }
  } finally {
    await canvas.close();
  }
  return files;
}

/**
 * The 20:00 evening reminder story. It names no page, so it is one file for every day,
 * rendered once rather than per page (and is not part of the frozen page release).
 */
export async function renderReminderStory(browser: Browser, file: string): Promise<void> {
  const canvas = await Canvas.open(browser, STORY);
  try {
    await canvas.load(await loadTemplate("StoryReminder.html"));
    await canvas.screenshot(file);
  } finally {
    await canvas.close();
  }
}

/** Instagram's copy of the story (the daily story, posted by apps/publisher). */
export const INSTAGRAM_STORY = "ig-story.jpg";

/**
 * Writes story.png as JPEG, the only image format Instagram's publishing API accepts. The PNG is
 * placed as it is, at its own size, on a canvas of the same size: nothing is redrawn.
 */
export async function renderInstagramStory(browser: Browser, dir: string): Promise<void> {
  const png = `data:image/png;base64,${(await fs.readFile(path.join(dir, "story.png"))).toString("base64")}`;
  const canvas = await Canvas.open(browser, STORY);
  try {
    await canvas.load(
      `<!doctype html><html><head></head><body style="margin:0"><div dir="rtl" style="width:${STORY.width}px;height:${STORY.height}px">` +
        `<img src="${png}" width="${STORY.width}" height="${STORY.height}" alt="" style="display:block"></div></body></html>`,
    );
    await canvas.screenshot(path.join(dir, INSTAGRAM_STORY));
  } finally {
    await canvas.close();
  }
}

/** Renders every generated asset of one page into `dir` and returns the manifest written to cards.json. */
export async function renderPage(browser: Browser, data: PageData, dir: string): Promise<PageCards> {
  for (const f of await fs.readdir(dir)) if (/^tafsir-\d+\.png$/.test(f)) await fs.rm(path.join(dir, f));

  await renderMushafTemplate(browser, data, dir, "PostDaily.html", POST, "post.png");
  await renderMushafTemplate(browser, data, dir, "StoryDaily.html", STORY, "story.png");
  await renderInstagramStory(browser, dir);
  const tafsir = await renderTafsirCards(browser, data, dir);

  const cards: PageCards = { mushaf: "mushaf.png", post: "post.png", story: "story.png", tafsir };
  await fs.writeFile(path.join(dir, "caption.txt"), caption(data));
  await fs.writeFile(path.join(dir, "cards.json"), JSON.stringify(cards, null, 2));
  return cards;
}

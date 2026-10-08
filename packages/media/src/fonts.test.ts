import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { Canvas, launchBrowser } from "./browser";
import { brandFontCss, injectFonts } from "./fonts";
import { loadTemplate } from "./template";

it("removes the Google Fonts links and inlines the local fonts", async () => {
  const html = await loadTemplate("Tafsir.html");
  expect(html).toContain("fonts.googleapis.com");
  const css = await brandFontCss();
  expect(css).not.toContain("./");
  expect(css.match(/data:font\/ttf;base64,/g)).toHaveLength(8);

  const out = injectFonts(html, css);
  expect(out).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  expect(out.indexOf(css)).toBeGreaterThan(out.indexOf("<head>"));
});

describe("in Chromium", () => {
  let browser: Browser;
  let canvas: Canvas;
  beforeAll(async () => {
    browser = await launchBrowser();
    canvas = await Canvas.open(browser, { width: 400, height: 200 });
  });
  afterAll(() => browser.close());

  const page = (body: string) => `<!doctype html><html><head></head><body><div dir="rtl">${body}</div></body></html>`;

  it("passes when every glyph is in its declared brand font", async () => {
    await canvas.load(page(`<p style="font-family:'Tajawal'">الصفحة ٢٤٥</p><p style="font-family:'Scheherazade New'">ذَٰلِكَ</p>`));
    expect(await canvas.fallbackGlyphs()).toEqual([]);
  });

  it("fails on glyphs the declared font does not have", async () => {
    await canvas.load(page(`<p style="font-family:'Tajawal'">漢字</p>`));
    expect(await canvas.fallbackGlyphs()).toEqual([expect.objectContaining({ declared: "Tajawal", text: "漢字" })]);
    await expect(canvas.assertNoFallback()).rejects.toThrow(/Fallback font glyphs/);
  });

  it("fails on a font family that is not a brand font", async () => {
    await canvas.load(page(`<p style="font-family:'No Such Font'">بسم الله</p>`));
    await expect(canvas.assertNoFallback()).rejects.toThrow(/instead of "No Such Font"/);
  });
});

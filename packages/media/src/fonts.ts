import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Brand fonts (SIL OFL), shipped with their @font-face rules in fonts.css. docs/06-brand.md */
const FONTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../handoff/brand/fonts");

const GOOGLE_FONTS_LINK = /<link[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/g;
const FONT_URL = /url\(['"]?\.\/([^'")]+)['"]?\)/g;

let fontCss: Promise<string> | undefined;

/** fonts.css with every `url('./x.ttf')` inlined as a data URL, so the page needs no network or file access. */
export function brandFontCss(): Promise<string> {
  fontCss ??= (async () => {
    const css = await fs.readFile(path.join(FONTS_DIR, "fonts.css"), "utf8");
    const files = new Map<string, string>();
    for (const [, file] of css.matchAll(FONT_URL)) {
      const data = await fs.readFile(path.join(FONTS_DIR, file!));
      files.set(file!, `url(data:font/ttf;base64,${data.toString("base64")})`);
    }
    return css.replace(FONT_URL, (_, file: string) => files.get(file)!);
  })();
  return fontCss;
}

/**
 * Removes the Google Fonts <link>s and puts `css` first in <head>. Google Fonts are never used in
 * the renderer: when they fail to load, Chromium silently draws the text in a fallback font.
 */
export function injectFonts(html: string, css: string): string {
  const stripped = html.replace(GOOGLE_FONTS_LINK, "");
  if (!stripped.includes("<head>")) throw new Error("Template has no <head>");
  return stripped.replace("<head>", () => `<head><style>${css}</style>`);
}

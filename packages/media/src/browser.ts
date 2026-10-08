import { chromium, type Browser, type CDPSession, type Page } from "playwright";
import { brandFontCss, injectFonts } from "./fonts";

export interface Size {
  width: number;
  height: number;
}

/** Every template's root element: `<div dir="rtl" style="width: …; height: …">`. */
const CANVAS = "body > div[dir=rtl]";

/** A glyph drawn in a font other than the one its element declares. */
export interface FallbackGlyphs {
  declared: string;
  used: string;
  glyphs: number;
  text: string;
}

const normalize = (family: string) => family.toLowerCase().replace(/[\s'"]/g, "");

/** A Chromium page that renders template HTML at an exact pixel size, in the brand fonts only. */
export class Canvas {
  private constructor(
    private readonly page: Page,
    private readonly cdp: CDPSession,
  ) {}

  static async open(browser: Browser, size: Size): Promise<Canvas> {
    const page = await browser.newPage({ viewport: size });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    return new Canvas(page, cdp);
  }

  /**
   * Loads the HTML with the local brand fonts and force-loads every font face.
   * Throws if any face is not 'loaded'. That alone does not prove the text uses them: call
   * `assertNoFallback()` before taking a screenshot.
   */
  async load(html: string): Promise<void> {
    await this.page.setContent(injectFonts(html, await brandFontCss()), { waitUntil: "load" });
    const faces = await this.page.evaluate(async () => {
      await Promise.all([...document.fonts].map((f) => f.load().catch(() => null)));
      await document.fonts.ready;
      return [...document.fonts].map((f) => ({ face: `${f.family} ${f.weight}`, status: f.status }));
    });
    const failed = faces.filter((f) => f.status !== "loaded").map((f) => f.face);
    if (faces.length === 0 || failed.length > 0) throw new Error(`Brand fonts did not load: ${failed.join(", ") || "none declared"}`);
  }

  /**
   * Asks Chromium which fonts actually drew each element's own text (CSS.getPlatformFontsForNode).
   * `document.fonts.check()` is no proof: it returns true when the text falls back to another font.
   * Port of handoff/reference-code/fontcheck.py.
   */
  async fallbackGlyphs(): Promise<FallbackGlyphs[]> {
    const { root } = await this.cdp.send("DOM.getDocument", { depth: -1 });
    const { nodeIds } = await this.cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "*" });
    // Same document order as DOM.querySelectorAll above: index → element with its own text.
    const texts = await this.page.evaluate(() =>
      [...document.querySelectorAll("*")].map((e) =>
        [...e.childNodes]
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent ?? "")
          .join("")
          .trim(),
      ),
    );
    if (texts.length !== nodeIds.length) throw new Error("DOM changed during the font check");

    const bad: FallbackGlyphs[] = [];
    for (const [i, nodeId] of nodeIds.entries()) {
      const text = texts[i]!;
      if (!text) continue;
      const { computedStyle } = await this.cdp.send("CSS.getComputedStyleForNode", { nodeId });
      const family = computedStyle.find((p) => p.name === "font-family")?.value ?? "";
      const declared = family.split(",")[0]!.trim().replace(/^['"]|['"]$/g, "");
      const { fonts } = await this.cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      for (const f of fonts) {
        if (!normalize(f.familyName).includes(normalize(declared))) {
          bad.push({ declared, used: f.familyName, glyphs: f.glyphCount, text: text.slice(0, 60) });
        }
      }
    }
    return bad;
  }

  /** Throws if any glyph on the page was drawn in a fallback font. */
  async assertNoFallback(): Promise<void> {
    const bad = await this.fallbackGlyphs();
    if (bad.length > 0) {
      const lines = bad.map((b) => `  ${b.glyphs} glyph(s) in "${b.used}" instead of "${b.declared}": ${b.text}`);
      throw new Error(`Fallback font glyphs:\n${lines.join("\n")}`);
    }
  }

  /** Puts `html` inside the element with `elementId` and reports whether it fits without overflowing. */
  contentFits(elementId: string, html: string): Promise<boolean> {
    return this.page.evaluate(
      ([id, content]) => {
        const box = document.getElementById(id);
        if (!box) throw new Error(`#${id} not found`);
        box.innerHTML = content;
        return box.scrollHeight <= box.clientHeight;
      },
      [elementId, html] as const,
    );
  }

  /** Checks every glyph's font (see `assertNoFallback`), then captures the canvas. */
  async screenshot(file: string): Promise<void> {
    await this.assertNoFallback();
    await this.page.locator(CANVAS).screenshot({ path: file });
  }

  close(): Promise<void> {
    return this.page.close();
  }
}

export const launchBrowser = (): Promise<Browser> => chromium.launch();

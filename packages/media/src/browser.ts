import { chromium, type Browser, type Page } from "playwright";

export interface Size {
  width: number;
  height: number;
}

const BRAND_FONTS = ["El Messiri", "Scheherazade New", "Tajawal"];
/** Every template's root element: `<div dir="rtl" style="width: …; height: …">`. */
const CANVAS = "body > div[dir=rtl]";

/** A Chromium page that renders template HTML at an exact pixel size. */
export class Canvas {
  private constructor(private readonly page: Page) {}

  static async open(browser: Browser, size: Size): Promise<Canvas> {
    return new Canvas(await browser.newPage({ viewport: size }));
  }

  /** Loads the HTML and waits for the brand fonts. Throws if they did not load: no fallback-font images. */
  async load(html: string): Promise<void> {
    await this.page.setContent(html, { waitUntil: "networkidle" });
    const loaded = await this.page.evaluate(async (fonts) => {
      await Promise.all(fonts.map((f) => document.fonts.load(`16px "${f}"`, "دَيْدَن")));
      await document.fonts.ready;
      return fonts.every((f) => document.fonts.check(`16px "${f}"`, "دَيْدَن"));
    }, BRAND_FONTS);
    if (!loaded) throw new Error("Brand fonts did not load");
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

  async screenshot(file: string): Promise<void> {
    await this.page.locator(CANVAS).screenshot({ path: file });
  }

  close(): Promise<void> {
    return this.page.close();
  }
}

export const launchBrowser = (): Promise<Browser> => chromium.launch();

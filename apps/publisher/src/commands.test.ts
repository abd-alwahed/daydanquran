import { describe, expect, it } from "vitest";
import { LAUNCH_DATE, TOTAL_PAGES, addDays } from "@daydan/core";
import { ABOUT, MAKEUP_LIMIT, khatmaCommand, makeupCommand, readCommand, todayCommand } from "./commands";
import { MemoryReadingStore } from "./reading/memory-store";
import { recordReading } from "./reading/record-reading";

/** 12:00 in Mecca on the day with this page (page 1 = launch day). */
const dayOfPage = (page: number) => new Date(`${addDays(LAUNCH_DATE, page - 1)}T09:00:00Z`);
const BEFORE_LAUNCH = new Date("2026-10-15T09:00:00Z");

const caption = (text: string | null): typeof fetch => async () =>
  text === null ? new Response("", { status: 404 }) : new Response(text);

describe("/today", () => {
  it("names the day's page and surah, links it, and offers the read button", async () => {
    const reply = await todayCommand(dayOfPage(3), caption("سورة البقرة · الجزء ١\n..."));
    expect(reply.text).toBe(
      "صفحة اليوم جاهزة: الصفحة ٣ من سورة البقرة.\n\nمع التفسير والتلاوة: https://daydanquran.pages.dev/p/3",
    );
    expect(reply.buttons).toEqual([[{ text: "قرأت الورد ✅", callback_data: "read:3" }]]);
  });

  it("still answers when the caption cannot be read", async () => {
    const reply = await todayCommand(dayOfPage(3), caption(null));
    expect(reply.text).toContain("صفحة اليوم جاهزة: الصفحة ٣.");
  });

  it("before launch, points to page 1 and the launch day", async () => {
    const reply = await todayCommand(BEFORE_LAUNCH, caption(null));
    expect(reply.text).toContain("نبدأ معاً يوم الجمعة ٢٣ أكتوبر بالصفحة الأولى");
    expect(reply.text).toContain("https://daydanquran.pages.dev/p/1");
    expect(reply.buttons?.[0]?.[0]?.callback_data).toBe("read:1");
  });
});

describe("/read", () => {
  it("records today's page like the button, once per day", async () => {
    const store = new MemoryReadingStore();
    await readCommand(store, "7", dayOfPage(5));
    const reply = await readCommand(store, "7", dayOfPage(5));
    expect(reply.text).toBe("تقبّل الله ✅ الصفحة ٥\nختمتك: ١ من ٦٠٤ صفحة.");
    expect(store.dailyLog.size).toBe(1);
  });
});

describe("/khatma", () => {
  it("invites a new reader to start, without any count", async () => {
    expect((await khatmaCommand(new MemoryReadingStore(), "7")).text).toBe("ختمتك تبدأ بأول صفحة تقرؤها.\nصفحة اليوم: /today");
  });

  it("shows pages read in the current khatma, and names the next khatma once one is complete", async () => {
    const store = new MemoryReadingStore();
    await recordReading(store, "7", 1, dayOfPage(1));
    await recordReading(store, "7", 2, dayOfPage(2));
    expect((await khatmaCommand(store, "7")).text).toBe("ختمتك: ٢ من ٦٠٤ صفحة.");

    for (let page = 3; page <= TOTAL_PAGES; page++) await recordReading(store, "7", page, dayOfPage(2));
    expect((await khatmaCommand(store, "7")).text).toBe("بدأت ختمتك الثانية.\nصفحة اليوم: /today");

    await recordReading(store, "7", 2, dayOfPage(2));
    expect((await khatmaCommand(store, "7")).text).toBe("ختمتك الثانية: ١ من ٦٠٤ صفحة.");
  });
});

describe("/makeup", () => {
  it("has nothing before launch or on launch day", async () => {
    const store = new MemoryReadingStore();
    expect((await makeupCommand(store, "7", BEFORE_LAUNCH)).text).toContain("ليس في «اقضِ ما فاتك» صفحات الآن");
    expect((await makeupCommand(store, "7", dayOfPage(1))).text).toContain("ليس في «اقضِ ما فاتك» صفحات الآن");
  });

  it("offers earlier unread pages, oldest first, each with its own button", async () => {
    const store = new MemoryReadingStore();
    await recordReading(store, "7", 2, dayOfPage(4));
    const reply = await makeupCommand(store, "7", dayOfPage(4));
    expect(reply.buttons?.map((row) => row[0]?.callback_data)).toEqual(["read:1", "read:3"]);
    expect(reply.buttons?.[0]?.[0]?.text).toBe("قرأت الصفحة ١ ✅");
    expect(reply.text).toContain("الصفحة ٣: https://daydanquran.pages.dev/p/3");
    expect(reply.text).not.toContain("/makeup");
  });

  it("shows a few pages and offers the next ones in the bot (not the site's list), never a count", async () => {
    const reply = await makeupCommand(new MemoryReadingStore(), "7", dayOfPage(30));
    expect(reply.buttons).toHaveLength(MAKEUP_LIMIT);
    expect(reply.text).toContain("أرسل /makeup لتصلك صفحات أخرى");
    expect(reply.text).not.toContain("/qada");
    expect(reply.text).not.toMatch(/٢٩/);
  });
});

describe("/about", () => {
  it("explains the name and links the about page", () => {
    expect(ABOUT).toContain("الدَّيْدَن: العادة الدائمة");
    expect(ABOUT).toContain("https://daydanquran.pages.dev/about");
  });
});

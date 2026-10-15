import path from "node:path";
import { describe, expect, it } from "vitest";
import { canvasSize, edit, leftoverPlaceholder, postFriday, postMilestone } from "./assets";
import { PLAN } from "./plan";
import { planDays, shortName } from "./folders";
import { entryMessages } from "./telegram";

describe("marketing plan", () => {
  const assets = PLAN.flatMap((e) => e.assets);

  it("fills every template placeholder", () => {
    for (const a of assets) expect(leftoverPlaceholder(a.html), a.file).toBeUndefined();
  });

  it("gives each image one file name and one design", () => {
    const byFile = new Map<string, string>();
    for (const a of assets) {
      expect(byFile.get(a.file) ?? a.html, a.file).toBe(a.html);
      byFile.set(a.file, a.html);
    }
  });

  it("renders only the brand sizes", () => {
    const sizes = new Set(assets.map((a) => Object.values(canvasSize(a.html)).join("×")));
    expect([...sizes].sort()).toEqual(["1080×1080", "1080×1350", "1080×1920", "1640×624"]);
  });

  it("keeps entries in date order, inside the planned month", () => {
    const dates = PLAN.map((e) => e.date);
    expect(dates).toEqual([...dates].sort());
    expect(dates[0]).toBe("2026-10-16");
    expect(dates.at(-1)).toBe("2026-11-21");
  });

  it("uses Arabic-Indic digits in the images", () => {
    for (const a of assets) {
      const visible = a.html
        .replace(/<style[\s\S]*?<\/style>/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/daydanquran\.pages\.dev|@daydanquran|\/reminder/g, "");
      expect(visible, a.file).not.toMatch(/[0-9]/);
    }
  });
});

describe("marketing templates", () => {
  it("fails loudly when a template no longer contains the text to replace", () => {
    expect(() => edit("abc", "x", "y")).toThrow(/appears 0 times/);
  });

  it("puts the completed juz in gold on the khatma meter", () => {
    const html = postMilestone("m.png", 1).html;
    expect(html.match(/background: #B8924A/g)).toHaveLength(1);
    expect(html.match(/background: #DEE6E9/g)).toHaveLength(29);
  });

  it("agrees the Friday count with its noun", () => {
    expect(postFriday("f.png", 7).html).toContain("٧ صفحات");
    expect(postFriday("f.png", 21).html).toContain("٢١ صفحة");
  });
});

describe("plan sent to Telegram", () => {
  const messages = PLAN.map((e) => entryMessages(e, "out"));

  it("opens each entry with its date and title, then its images", () => {
    const quote = messages[PLAN.findIndex((e) => e.date === "2026-10-19")]!;
    expect(quote[0]).toEqual({ text: "الاثنين، ١٩ أكتوبر · ٢٠:٣٠ · منشور\nاقتباس: أدومها وإن قلّ" });
    expect(quote[1]).toEqual({ files: [path.join("out", "2026-10-19", "quote.png")] });
    expect(quote[2]).toEqual({ text: PLAN.find((e) => e.date === "2026-10-19")!.caption });
  });

  it("keeps every album within Telegram's 10 files", () => {
    for (const m of messages.flat()) if ("files" in m) expect(m.files.length).toBeLessThanOrEqual(10);
  });

  it("keeps every text within Telegram's 4096 characters", () => {
    for (const m of messages.flat()) if ("text" in m) expect(m.text.length).toBeLessThanOrEqual(4096);
  });
});

describe("day folders", () => {
  const days = planDays(PLAN);

  it("makes one folder per posting date, with at most one caption", () => {
    expect(days.map((d) => d.date)).toEqual([...new Set(PLAN.map((e) => e.date))]);
  });

  it("gives every file in a folder its own name", () => {
    for (const d of days) {
      const names = d.files.map((f) => f.name);
      expect(new Set(names).size, d.date).toBe(names.length);
    }
  });

  it("drops the date from file names, since the folder carries it", () => {
    expect(shortName("2026-10-17-what-1.png")).toBe("what-1.png");
    expect(shortName("friday-story.png")).toBe("friday-story.png");
  });

  it("copies shared images into every day that posts them", () => {
    const fridays = days.filter((d) => d.files.some((f) => f.name === "friday-story.png")).map((d) => d.date);
    expect(fridays).toEqual([
      "2026-10-16",
      "2026-10-23",
      "2026-10-30",
      "2026-11-06",
      "2026-11-13",
      "2026-11-20",
    ]);
  });
});

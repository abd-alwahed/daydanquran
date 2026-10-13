import { describe, expect, it } from "vitest";
import type { Ayah, AyahKey, PageData } from "@daydan/core";
import { reviewFlags } from "./review-flags";

const ayah = (surah: number, n: number, extra: Partial<Ayah> = {}): Ayah => ({
  key: `${surah}:${n}` as AyahKey,
  surah,
  ayah: n,
  juz: 1,
  text: "",
  tafsir: "",
  audio: "",
  ...extra,
});

const page = (ayahs: Ayah[], surahs = [{ id: 2, name: "البقرة" }], juz = [1]): PageData => ({ page: 8, surahs, juz, ayahs });

describe("reviewFlags", () => {
  it("leaves an ordinary page unflagged", () => {
    expect(reviewFlags(page([ayah(2, 5), ayah(2, 6)]), 4)).toEqual([]);
  });

  it("flags a surah start and a page with two surahs", () => {
    const data = page([ayah(2, 286), ayah(3, 1)], [{ id: 2, name: "البقرة" }, { id: 3, name: "آل عمران" }]);
    expect(reviewFlags(data, 4)).toEqual(["تبدأ فيها سورة آل عمران", "فيها سورتان"]);
  });

  it("flags a juz boundary", () => {
    expect(reviewFlags(page([ayah(2, 141)], undefined, [1, 2]), 4)).toEqual(["فيها بداية الجزء ٢"]);
  });

  it("flags a tafsir passage that crosses the page edge, either way", () => {
    expect(reviewFlags(page([ayah(2, 6, { tafsirWith: "2:5" })]), 4)).toEqual(["فقرة تفسير تمتد إلى صفحة أخرى"]);
    expect(reviewFlags(page([ayah(2, 6, { tafsirCovers: ["2:6", "2:7"] })]), 4)).toEqual(["فقرة تفسير تمتد إلى صفحة أخرى"]);
    expect(reviewFlags(page([ayah(2, 6, { tafsirCovers: ["2:6", "2:7"] }), ayah(2, 7, { tafsirWith: "2:6" })]), 4)).toEqual([]);
  });

  it("flags a page with many tafsir cards", () => {
    expect(reviewFlags(page([ayah(2, 5)]), 6)).toEqual([]);
    expect(reviewFlags(page([ayah(2, 5)]), 7)).toEqual(["٧ بطاقات تفسير"]);
  });
});

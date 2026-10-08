import { describe, expect, it } from "vitest";
import { tafsirUnits } from "./tafsir";
import type { Ayah, AyahKey, PageData } from "./types";

const ayah = (key: AyahKey, extra: Partial<Ayah> = {}): Ayah => {
  const [surah, n] = key.split(":").map(Number) as [number, number];
  return { key, surah, ayah: n, juz: 1, text: "", tafsir: "", audio: "", ...extra };
};
const page = (ayahs: Ayah[]): PageData => ({ page: 1, surahs: [], juz: [1], ayahs });

describe("tafsirUnits", () => {
  it("shows a group explained in one passage once, labelled with its range", () => {
    const units = tafsirUnits(
      page([
        ayah("4:65", { tafsir: "أ" }),
        ayah("4:66", { tafsir: "ب", tafsirCovers: ["4:66", "4:67", "4:68"] }),
        ayah("4:67", { tafsirWith: "4:66" }),
        ayah("4:68", { tafsirWith: "4:66" }),
      ]),
    );
    expect(units.map((u) => [u.label, u.text])).toEqual([
      ["٦٥", "أ"],
      ["٦٦–٦٨", "ب"],
    ]);
  });

  it("points to the previous page for a group that started there", () => {
    const units = tafsirUnits(
      page([ayah("56:2", { tafsirWith: "56:1" }), ayah("56:3", { tafsirWith: "56:1" }), ayah("56:4", { tafsir: "ج" })]),
    );
    expect(units).toHaveLength(2);
    expect(units[0]).toMatchObject({ isPointer: true, label: "٢–٣" });
    expect(units[0]?.text).toContain("الآية ١ في الصفحة السابقة");
  });
});

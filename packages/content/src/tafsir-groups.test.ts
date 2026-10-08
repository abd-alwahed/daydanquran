import { describe, expect, it } from "vitest";
import type { AyahKey } from "@daydan/core";
import type { TafsirGroup } from "./sources/quran-com";
import { TafsirGroups } from "./tafsir-groups";

const takwir = (n: number): AyahKey => `81:${n}`;
const FIRST_TEN = Array.from({ length: 10 }, (_, i) => takwir(i + 1));

describe("TafsirGroups", () => {
  it("extends a group the API truncated at ten ayahs when the API returns the same passage", async () => {
    const groups = new TafsirGroups(async (): Promise<TafsirGroup> => ({ covers: FIRST_TEN, text: "إذا الشمس كورت…" }));
    for (const n of [2, 11, 12, 13, 14]) await groups.resolve(takwir(n));
    expect(groups.get(takwir(1))?.covers).toEqual([...FIRST_TEN, "81:11", "81:12", "81:13", "81:14"]);
    expect(groups.size).toBe(1);
  });

  it("refuses two different passages for one group", async () => {
    let call = 0;
    const groups = new TafsirGroups(async () => ({ covers: [takwir(1), takwir(2)], text: call++ ? "ب" : "أ" }));
    await groups.resolve(takwir(2));
    await expect(groups.resolve(takwir(3))).rejects.toThrow();
  });

  it("does not attach an ayah from another surah", async () => {
    const groups = new TafsirGroups(async () => ({ covers: ["80:40", "80:41"], text: "أ" }));
    await groups.resolve("81:1");
    expect(groups.get("81:1")).toBeUndefined();
  });
});

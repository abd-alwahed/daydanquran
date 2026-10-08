import { describe, expect, it } from "vitest";
import type { AyahKey, PageData } from "@daydan/core";
import { validateCorpus } from "./validate-corpus";

const page = (n: number, keys: AyahKey[]): PageData => ({
  page: n,
  surahs: [],
  juz: [1],
  ayahs: keys.map((key) => ({ key, surah: 1, ayah: 1, juz: 1, text: "", tafsir: "", audio: "" })),
});

describe("validateCorpus", () => {
  it("reports a duplicated ayah", () => {
    expect(validateCorpus([page(1, ["1:1"]), page(2, ["1:1"])], ["1:1"])).toContainEqual(expect.stringContaining("مكررة"));
  });

  it("reports an ayah that is on no page", () => {
    expect(validateCorpus([page(1, ["1:1"])], ["1:1", "1:2"])).toContainEqual(expect.stringContaining("1:2"));
  });

  it("reports pages out of Mushaf order", () => {
    expect(validateCorpus([page(1, ["1:2"]), page(2, ["1:1"])], ["1:1", "1:2"])).toContainEqual(
      expect.stringContaining("بعد الصفحة"),
    );
  });
});

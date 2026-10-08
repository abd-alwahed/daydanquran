import { describe, expect, it } from "vitest";
import { arabicLetters, stripHtml } from "./text";

describe("arabicLetters", () => {
  it("ignores harakat, waqf marks and tatweel so the two sources can be compared", () => {
    expect(arabicLetters("ذَٰلِكَ ٱلْكِتَـٰبُ لَا رَيْبَ ۛ فِيهِ")).toBe(arabicLetters("ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ فِيهِ"));
  });

  it("still tells different words apart", () => {
    expect(arabicLetters("قُلْ")).not.toBe(arabicLetters("قَالَ"));
  });
});

describe("stripHtml", () => {
  it("removes tags and keeps every word", () => {
    expect(stripHtml('أبتدئ <span class="green">(اللهِ)</span>  علم')).toBe("أبتدئ (اللهِ) علم");
  });
});

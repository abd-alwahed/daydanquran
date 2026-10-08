import { describe, expect, it } from "vitest";
import type { TafsirUnit } from "@daydan/core";
import { packTafsirCards, type CardPiece } from "./tafsir-cards";

const unit = (surah: number, from: number, text: string): TafsirUnit => ({
  surah, from, to: from, label: String(from), text, isPointer: false,
});
/** A card holds at most `capacity` characters of text. */
const fitsWithin = (capacity: number) => async (pieces: readonly CardPiece[]) =>
  pieces.reduce((n, p) => n + p.text.length, 0) <= capacity;
const text = (pieces: readonly CardPiece[]) => pieces.map((p) => p.text).join(" ");

describe("packTafsirCards", () => {
  it("puts whole ayahs together while they fit", async () => {
    const cards = await packTafsirCards([unit(1, 1, "أأأ"), unit(1, 2, "ببب"), unit(1, 3, "ججج")], fitsWithin(6));
    expect(cards.map(text)).toEqual(["أأأ ببب", "ججج"]);
  });

  it("never mixes two surahs on one card", async () => {
    const cards = await packTafsirCards([unit(113, 5, "أ"), unit(114, 1, "ب")], fitsWithin(100));
    expect(cards).toHaveLength(2);
  });

  it("splits a long passage only at sentence ends, losing no character", async () => {
    const long = "جملة أولى. جملة ثانية؟ جملة ثالثة.";
    const cards = await packTafsirCards([unit(2, 3, long)], fitsWithin(22));
    expect(cards.length).toBeGreaterThan(1);
    expect(cards.flat().map((p) => p.text).join(" ")).toBe(long);
    expect(cards.flat().filter((p) => p.isFirst)).toHaveLength(1);
  });

  it("falls back to clause boundaries for a sentence longer than a card", async () => {
    const long = "مقطع أول، مقطع ثان، مقطع ثالث.";
    const cards = await packTafsirCards([unit(2, 3, long)], fitsWithin(12));
    expect(cards.flat().map((p) => p.text).join(" ")).toBe(long);
  });

  it("fails rather than cut a word", async () => {
    await expect(packTafsirCards([unit(2, 3, "كلمةطويلةجداًبلاحدود")], fitsWithin(5))).rejects.toThrow();
  });
});

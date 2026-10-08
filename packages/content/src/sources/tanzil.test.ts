import { describe, expect, it } from "vitest";
import { parseTanzil } from "./tanzil";

const RAW = [
  "1|1|بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
  "2|1|بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ",
  "9|1|بَرَآءَةٌ مِّنَ ٱللَّهِ",
  "95|1|بِّسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ وَٱلتِّينِ وَٱلزَّيْتُونِ",
  "",
  "# Tanzil Quran Text",
].join("\n");

describe("parseTanzil", () => {
  const { ayahs, license } = parseTanzil(RAW);

  it("keeps the basmala as al-Fatiha's first ayah", () => {
    expect(ayahs.get("1:1")).toBe("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");
  });

  it("separates the prefixed basmala from ayah 1 of other surahs, whatever its diacritics", () => {
    expect(ayahs.get("2:1")).toBe("الٓمٓ");
    expect(ayahs.get("95:1")).toBe("وَٱلتِّينِ وَٱلزَّيْتُونِ");
  });

  it("leaves at-Tawba untouched", () => {
    expect(ayahs.get("9:1")).toBe("بَرَآءَةٌ مِّنَ ٱللَّهِ");
  });

  it("keeps the license block", () => {
    expect(license).toContain("Tanzil");
  });

  it("fails loudly when a surah does not start with the basmala", () => {
    expect(() => parseTanzil("3|1|الٓمٓ")).toThrow();
  });
});

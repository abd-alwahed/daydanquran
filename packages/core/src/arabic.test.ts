import { expect, it } from "vitest";
import { arabicRange, toArabicDigits } from "./arabic";

it("converts digits to Arabic-Indic", () => {
  expect(toArabicDigits(245)).toBe("٢٤٥");
  expect(arabicRange(6, 8)).toBe("٦–٨");
  expect(arabicRange(5, 5)).toBe("٥");
});

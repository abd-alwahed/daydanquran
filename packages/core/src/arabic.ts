const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";

/** Replaces Western digits with Arabic-Indic ones: 245 → ٢٤٥. */
export function toArabicDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => ARABIC_INDIC[Number(d)]!);
}

/** "٥" for a single number, "٦–٨" for a range. */
export function arabicRange(from: number, to: number): string {
  return from === to ? toArabicDigits(from) : `${toArabicDigits(from)}–${toArabicDigits(to)}`;
}

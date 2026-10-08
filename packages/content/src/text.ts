// Used only to compare sources and to strip markup. Quran and tafsir text is never rewritten.

/** Base letters only: no harakat, Quranic annotation marks, tatweel or whitespace. */
export function arabicLetters(text: string): string {
  return text.normalize("NFD").replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ\s]/g, "");
}

/** Removes HTML tags and collapses whitespace. The only change ever made to tafsir text. */
export function stripHtml(html = ""): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

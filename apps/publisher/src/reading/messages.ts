import { TOTAL_PAGES, toArabicDigits } from "@daydan/core";
import type { ReadingOutcome } from "./record-reading";

// Wording from the message library (handoff/docs/06-brand.md). Shown to the reader alone, never public.
export function readingReply({ pagesInKhatma, completedKhatma }: ReadingOutcome): string {
  if (completedKhatma) return "ختمت القرآن مع دَيْدَن. تقبّل الله منك، ونبدأ معاً من جديد.";
  return `تقبّل الله ✅ ختمتك: ${toArabicDigits(pagesInKhatma)} من ${toArabicDigits(TOTAL_PAGES)} صفحة`;
}

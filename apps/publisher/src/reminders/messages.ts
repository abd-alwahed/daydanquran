import { PRAYER_NAMES, SITE_URL, toArabicDigits, type DueReminder } from "@daydan/core";

/**
 * A reminder's text. The first line is the message library's wording (handoff/docs/06-brand.md);
 * the second links to the day's page.
 */
export function reminderText(reminder: DueReminder, page: number, surah: string | null): string {
  const n = toArabicDigits(page);
  const line = (() => {
    switch (reminder.kind) {
      case "daily":
        if (reminder.prayer) return `بعد صلاة ${PRAYER_NAMES[reminder.prayer]}: وِردك اليوم صفحة واحدة.`;
        return surah ? `صفحة اليوم جاهزة: الصفحة ${n} من سورة ${surah}.` : `صفحة اليوم جاهزة: الصفحة ${n}.`;
      case "evening":
        return "لم تقرأ وِردك اليوم بعد، وما زال في اليوم متّسع.";
      case "weekly":
        return "صفحة اليوم بانتظارك، ولو آية واحدة.";
      case "ramadan":
        return "أقبل رمضان، شهر القرآن. صفحة اليوم بانتظارك.";
    }
  })();
  return `${line}\n\n${SITE_URL}/p/${page}`;
}

/** The surah name in a page's caption.txt ("سورة آل عمران · الجزء ٣"), written by the renderer. */
export function surahFromCaption(caption: string): string | null {
  return /^سورة (.+?) · /m.exec(caption)?.[1] ?? null;
}

import { LAUNCH_DATE, SITE_URL, TOTAL_PAGES, pagesToMakeUp, toArabicDigits, todaysPage } from "@daydan/core";
import { readButton } from "./read-button";
import { readingReply } from "./reading/messages";
import { recordReading } from "./reading/record-reading";
import type { ReadingStore } from "./reading/store";
import { surahFromCaption } from "./reminders/messages";
import type { InlineButton } from "./telegram";

/** A bot reply in the reader's private chat. */
export interface Reply {
  text: string;
  buttons?: InlineButton[][];
}

/** How many make-up pages one /makeup message offers; the rest are on the site. */
export const MAKEUP_LIMIT = 5;

const ALL_PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
const pageLink = (page: number) => `${SITE_URL}/p/${page}`;
const launchDay = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", timeZone: "UTC" }).format(
  new Date(`${LAUNCH_DATE}T00:00:00Z`),
);

/** /today: the day's page with its link and the "قرأت الورد" button. Page 1 stands in before launch. */
export async function todayCommand(now: Date, fetchImpl: typeof fetch = fetch): Promise<Reply> {
  const scheduled = todaysPage(LAUNCH_DATE, now);
  const page = scheduled?.page ?? 1;
  // The surah comes from the page's caption on the site; without it the reply still names the page.
  const caption = await fetchImpl(`${SITE_URL}/p/${page}/caption.txt`).catch(() => null);
  const surah = caption?.ok ? surahFromCaption(await caption.text()) : null;
  const n = toArabicDigits(page);
  const line = scheduled
    ? surah
      ? `صفحة اليوم: الصفحة ${n} من سورة ${surah}.`
      : `صفحة اليوم: الصفحة ${n}.`
    : `نبدأ معاً يوم ${launchDay} بالصفحة ١ من سورة الفاتحة.`;
  return { text: `${line}\n\n${pageLink(page)}`, buttons: [[readButton(page)]] };
}

/** /read: the same as pressing "قرأت الورد" under today's page. */
export async function readCommand(store: ReadingStore, userId: string, now: Date): Promise<Reply> {
  const page = todaysPage(LAUNCH_DATE, now)?.page ?? 1;
  return { text: readingReply(await recordReading(store, userId, page, now)) };
}

/** /khatma: pages read in the reader's current khatma. */
export async function khatmaCommand(store: ReadingStore, userId: string): Promise<Reply> {
  const reader = await store.findOrCreateReader("telegram", userId);
  const read = (await store.khatmaPages(reader.id, reader.currentKhatma)).length;
  if (read === 0 && reader.currentKhatma === 1) {
    return { text: "ختمتك تبدأ بأول صفحة تقرؤها. صفحة اليوم: /today" };
  }
  const which = reader.currentKhatma > 1 ? `ختمتك رقم ${toArabicDigits(reader.currentKhatma)}` : "ختمتك";
  return { text: `${which}: ${toArabicDigits(read)} من ${toArabicDigits(TOTAL_PAGES)} صفحة.` };
}

/**
 * /makeup: a few earlier pages not yet read, oldest first, each with its own "قرأت" button.
 * An optional way to complete the khatma, never a debt: no count of missed pages is shown.
 */
export async function makeupCommand(store: ReadingStore, userId: string, now: Date): Promise<Reply> {
  const reader = await store.findOrCreateReader("telegram", userId);
  const read = new Set(await store.khatmaPages(reader.id, reader.currentKhatma));
  const pages = pagesToMakeUp(todaysPage(LAUNCH_DATE, now), read, ALL_PAGES);
  if (pages.length === 0) return { text: "لا صفحات في «اقضِ ما فاتك» الآن. صفحة اليوم: /today" };

  const shown = pages.slice(0, MAKEUP_LIMIT);
  const lines = shown.map((page) => `الصفحة ${toArabicDigits(page)}: ${pageLink(page)}`);
  const more = pages.length > shown.length ? `\n\nوبقية الصفحات على الموقع: ${SITE_URL}/qada` : "";
  return {
    text: `إن أحببت أن تكمل ختمتك، هذه صفحات مرّت قبل اليوم:\n\n${lines.join("\n")}${more}`,
    buttons: shown.map((page) => [{ ...readButton(page), text: `قرأت الصفحة ${toArabicDigits(page)} ✅` }]),
  };
}

export const ABOUT = [
  "الدَّيْدَن: العادة الدائمة التي لا تنقطع. صفحة من القرآن كل يوم، حتى يصير القرآن دَيْدَنك.",
  "",
  "كل يوم صفحة واحدة من مصحف المدينة، يقرؤها الجميع في اليوم نفسه، مع التفسير الميسر وتلاوة الشيخ محمود خليل الحصري. بعد الصفحة ٦٠٤ نبدأ معاً ختمة جديدة.",
  "",
  "صفحات المصحف والتفسير الميسر: مجمع الملك فهد لطباعة المصحف الشريف.",
  "دَيْدَن مشروع غير ربحي.",
  "",
  `${SITE_URL}/about`,
].join("\n");

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

/** How many make-up pages one /makeup message offers; the next ones come with the next /makeup. */
export const MAKEUP_LIMIT = 5;

const ALL_PAGES = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
const pageLink = (page: number) => `${SITE_URL}/p/${page}`;
/** "الجمعة ٢٣ أكتوبر". */
const launchDay = new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
  .format(new Date(`${LAUNCH_DATE}T00:00:00Z`))
  .replace("،", "");
/** "الثانية" for the second khatma; a number beyond the tenth. */
const ORDINALS = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة"];
const khatmaName = (khatma: number) => ORDINALS[khatma - 1] ?? `رقم ${toArabicDigits(khatma)}`;

/** /today: the day's page with its link and the "قرأت الورد" button. Page 1 stands in before launch. */
export async function todayCommand(now: Date, fetchImpl: typeof fetch = fetch): Promise<Reply> {
  const scheduled = todaysPage(LAUNCH_DATE, now);
  const page = scheduled?.page ?? 1;
  // The surah comes from the page's caption on the site; without it the reply still names the page.
  const caption = await fetchImpl(`${SITE_URL}/p/${page}/caption.txt`).catch(() => null);
  const surah = caption?.ok ? surahFromCaption(await caption.text()) : null;
  const n = toArabicDigits(page);
  // The morning reminder's wording (message library in handoff/docs/06-brand.md).
  const line = scheduled
    ? surah
      ? `صفحة اليوم جاهزة: الصفحة ${n} من سورة ${surah}.`
      : `صفحة اليوم جاهزة: الصفحة ${n}.`
    : `نبدأ معاً يوم ${launchDay} بالصفحة الأولى، وهي بين يديك من الآن.`;
  return { text: `${line}\n\nمع التفسير والتلاوة: ${pageLink(page)}`, buttons: [[readButton(page)]] };
}

/** /read: the same as pressing "قرأت الورد" under today's page. */
export async function readCommand(store: ReadingStore, userId: string, now: Date): Promise<Reply> {
  const page = todaysPage(LAUNCH_DATE, now)?.page ?? 1;
  const outcome = await recordReading(store, userId, page, now);
  if (outcome.completedKhatma) return { text: readingReply(outcome) };
  // A message stays in the chat, unlike the button's toast, so it also names the page counted.
  return {
    text: `تقبّل الله ✅ الصفحة ${toArabicDigits(page)}\nختمتك: ${toArabicDigits(outcome.pagesInKhatma)} من ${toArabicDigits(TOTAL_PAGES)} صفحة.`,
  };
}

/** /khatma: pages read in the reader's current khatma. */
export async function khatmaCommand(store: ReadingStore, userId: string): Promise<Reply> {
  const reader = await store.findOrCreateReader("telegram", userId);
  const read = (await store.khatmaPages(reader.id, reader.currentKhatma)).length;
  if (read === 0) {
    const start = reader.currentKhatma === 1 ? "ختمتك تبدأ بأول صفحة تقرؤها." : `بدأت ختمتك ${khatmaName(reader.currentKhatma)}.`;
    return { text: `${start}\nصفحة اليوم: /today` };
  }
  const which = reader.currentKhatma > 1 ? `ختمتك ${khatmaName(reader.currentKhatma)}` : "ختمتك";
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
  if (pages.length === 0) return { text: "ليس في «اقضِ ما فاتك» صفحات الآن.\nصفحة اليوم: /today" };

  const shown = pages.slice(0, MAKEUP_LIMIT);
  const lines = shown.map((page) => `الصفحة ${toArabicDigits(page)}: ${pageLink(page)}`);
  // Not the site's /qada list: that one follows the browser's own progress, not the bot's.
  const more = pages.length > shown.length ? "\n\nوبعدها أرسل /makeup لتصلك صفحات أخرى." : "";
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
  "التلاوة: الشيخ محمود خليل الحصري (مرتّل).",
  "دَيْدَن مشروع غير ربحي.",
  "",
  `${SITE_URL}/about`,
].join("\n");

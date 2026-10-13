import { toArabicDigits, type PageData } from "@daydan/core";

/** Pages with at least this many tafsir cards are long enough to deserve a closer look at the splits. */
export const MANY_TAFSIR_CARDS = 7;

/**
 * Why a page needs a closer look than usual, in Arabic for the review screen. Empty for an ordinary page.
 * These are the places where our own processing (not the sources) is most likely to go wrong.
 */
export function reviewFlags(data: PageData, tafsirCards: number): string[] {
  const flags: string[] = [];
  const names = new Map(data.surahs.map((s) => [s.id, s.name]));
  for (const a of data.ayahs) if (a.ayah === 1) flags.push(`تبدأ فيها سورة ${names.get(a.surah)}`);
  const surahs = data.surahs.length;
  if (surahs > 1) flags.push(surahs === 2 ? "فيها سورتان" : `فيها ${toArabicDigits(surahs)} سور`);
  if (data.juz.length > 1) flags.push(`فيها بداية الجزء ${toArabicDigits(data.juz.at(-1)!)}`);
  const keys = new Set(data.ayahs.map((a) => a.key));
  if (data.ayahs[0]?.tafsirWith || data.ayahs.some((a) => a.tafsirCovers?.some((k) => !keys.has(k)))) {
    flags.push("فقرة تفسير تمتد إلى صفحة أخرى");
  }
  if (tafsirCards >= MANY_TAFSIR_CARDS) flags.push(`${toArabicDigits(tafsirCards)} بطاقات تفسير`);
  return flags;
}

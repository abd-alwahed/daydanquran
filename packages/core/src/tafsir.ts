import { arabicRange, toArabicDigits } from "./arabic";
import type { AyahKey, PageData } from "./types";

/**
 * One displayable block of tafsir: a single ayah, a group of ayahs that Tafsir Muyassar
 * explains in one passage, or a pointer to a group that started on the previous page.
 */
export interface TafsirUnit {
  surah: number;
  from: number;
  to: number;
  /** Arabic-Indic ayah number or range, e.g. "٦٦–٦٨". */
  label: string;
  text: string;
  /** True for a pointer to a group that started on an earlier page (our wording, not tafsir). */
  isPointer: boolean;
}

const ayahNumber = (key: AyahKey): number => Number(key.split(":")[1]);

/**
 * Splits a page's tafsir into display units, in Mushaf order.
 * A group's text appears once, on the page where the group starts.
 */
export function tafsirUnits(data: PageData): TafsirUnit[] {
  const onPage = new Set(data.ayahs.map((a) => a.key));
  const units: TafsirUnit[] = [];
  let pointerStart: AyahKey | undefined;

  for (const ayah of data.ayahs) {
    if (ayah.tafsir) {
      const covers = ayah.tafsirCovers ?? [ayah.key];
      const from = ayahNumber(covers[0]!);
      const to = ayahNumber(covers.at(-1)!);
      units.push({ surah: ayah.surah, from, to, label: arabicRange(from, to), text: ayah.tafsir, isPointer: false });
      pointerStart = undefined;
      continue;
    }
    if (!ayah.tafsirWith || onPage.has(ayah.tafsirWith)) continue;

    const last = units.at(-1);
    if (last?.isPointer && pointerStart === ayah.tafsirWith) {
      last.to = ayah.ayah;
      last.label = arabicRange(last.from, last.to);
      continue;
    }
    pointerStart = ayah.tafsirWith;
    units.push({
      surah: ayah.surah,
      from: ayah.ayah,
      to: ayah.ayah,
      label: toArabicDigits(ayah.ayah),
      text: `تفسيرها مع الآية ${toArabicDigits(ayahNumber(ayah.tafsirWith))} في الصفحة السابقة.`,
      isPointer: true,
    });
  }
  return units;
}

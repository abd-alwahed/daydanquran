import type { Ayah, AyahKey, PageData } from "@daydan/core";
import type { QuranComSource } from "./sources/quran-com";
import type { TafsirGroups } from "./tafsir-groups";
import { arabicLetters } from "./text";

export interface PageBuild {
  data: PageData;
  mushaf: Buffer;
  errors: string[];
}

const PNG_SIGNATURE = "PNG";

/**
 * Assembles one page from the sources and checks it.
 * Ayah text always comes from Tanzil; Quran.com's text is used only to confirm the page layout.
 */
export async function buildPage(
  page: number,
  source: QuranComSource,
  tanzil: ReadonlyMap<AyahKey, string>,
  chapterNames: ReadonlyMap<number, string>,
  groups: TafsirGroups,
): Promise<PageBuild> {
  const [verses, tafsir, mushaf] = await Promise.all([
    source.versesOnPage(page),
    source.tafsirOnPage(page),
    source.mushafImage(page),
  ]);
  const errors: string[] = [];

  const ayahs: Ayah[] = verses.map((v) => {
    const text = tanzil.get(v.key) ?? "";
    if (!text) errors.push(`${v.key}: غير موجودة في Tanzil`);
    else if (arabicLetters(text) !== arabicLetters(v.textForCheck)) errors.push(`${v.key}: حروف Quran.com لا تطابق Tanzil`);
    if (!v.audio) errors.push(`${v.key}: صوت مفقود`);
    return { key: v.key, surah: v.surah, ayah: v.ayah, juz: v.juz, text, tafsir: tafsir.get(v.key) ?? "", audio: v.audio ?? "" };
  });
  if (ayahs.length === 0) errors.push("صفحة فارغة");

  // An ayah without text of its own must belong to a group whose passage starts at an earlier ayah.
  for (const ayah of ayahs.filter((a) => !a.tafsir)) {
    const group = await groups.resolve(ayah.key);
    if (group.covers[0] === ayah.key || !group.covers.includes(ayah.key) || !group.text) {
      errors.push(`${ayah.key}: تفسير مفقود`);
    } else {
      ayah.tafsirWith = group.covers[0];
    }
  }

  if (mushaf.subarray(1, 4).toString() !== PNG_SIGNATURE) errors.push("صورة المصحف ليست PNG");

  const surahIds = [...new Set(ayahs.map((a) => a.surah))];
  return {
    data: {
      page,
      surahs: surahIds.map((id) => ({ id, name: chapterNames.get(id) ?? "" })),
      juz: [...new Set(ayahs.map((a) => a.juz))],
      ayahs,
    },
    mushaf,
    errors,
  };
}

/** Marks the first ayah of each group with the ayahs its passage covers. Run after all pages are built. */
export function annotateGroupStarts(pages: PageData[], groups: TafsirGroups): string[] {
  const errors: string[] = [];
  for (const data of pages) {
    for (const ayah of data.ayahs) {
      const group = groups.get(ayah.key);
      if (!ayah.tafsir || !group || group.covers[0] !== ayah.key) continue;
      if (group.text !== ayah.tafsir) errors.push(`${ayah.key}: نص المجموعة يختلف بين by_page و by_ayah`);
      ayah.tafsirCovers = group.covers;
    }
  }
  return errors;
}

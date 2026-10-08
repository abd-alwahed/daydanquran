/** A calendar date as "YYYY-MM-DD". */
export type IsoDate = string;

/** An ayah reference as "surah:ayah", e.g. "2:255". */
export type AyahKey = `${number}:${number}`;

export interface Ayah {
  key: AyahKey;
  surah: number;
  ayah: number;
  juz: number;
  /** Uthmani text from Tanzil, verbatim. */
  text: string;
  /** Tafsir Muyassar text. Empty when this ayah is explained together with an earlier one. */
  tafsir: string;
  /** Set on the first ayah of a group that Tafsir Muyassar explains in one passage. */
  tafsirCovers?: AyahKey[];
  /** Set on the other ayahs of such a group: the key of the ayah that holds the text. */
  tafsirWith?: AyahKey;
  /** Per-ayah recitation file (Husary, murattal). */
  audio: string;
}

export interface SurahRef {
  id: number;
  name: string;
}

export interface PageData {
  page: number;
  surahs: SurahRef[];
  juz: number[];
  ayahs: Ayah[];
}

/** File names of a page's generated media, as written by the renderer. */
export interface PageCards {
  mushaf: string;
  post: string;
  story: string;
  tafsir: string[];
}

export interface ScheduledPage {
  page: number;
  /** 1 for the first pass through the Mushaf, 2 after page 604, and so on. */
  khatma: number;
  /** 1 on launch day. */
  dayNumber: number;
}

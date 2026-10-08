import type { AyahKey } from "@daydan/core";
import { cachedText } from "../http-cache";
import { arabicLetters } from "../text";

const TANZIL_URL = "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true";
const BASMALA_LETTERS = arabicLetters("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ");
const BASMALA_WORDS = 4;

export interface TanzilText {
  ayahs: Map<AyahKey, string>;
  /** Tanzil's copyright block, which must be kept with the text. */
  license: string;
}

/**
 * Parses Tanzil's "surah|ayah|text" format.
 * Tanzil prefixes the basmala to ayah 1 of every surah except al-Fatiha (where it is the ayah)
 * and at-Tawba (which has none); it is not part of the ayah, so it is separated.
 * Its diacritics vary (e.g. «بِّسْمِ» in at-Tin), so it is matched by letters.
 */
export function parseTanzil(raw: string): TanzilText {
  const lines = raw.split(/\r?\n/);
  const ayahs = new Map<AyahKey, string>();
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    const [surah, ayah, text] = line.split("|") as [string, string, string];
    let verse = text.normalize("NFC");
    if (ayah === "1" && surah !== "1" && surah !== "9") {
      const words = verse.split(" ");
      if (arabicLetters(words.slice(0, BASMALA_WORDS).join(" ")) !== BASMALA_LETTERS) {
        throw new Error(`${surah}:1 does not start with the basmala in Tanzil`);
      }
      verse = words.slice(BASMALA_WORDS).join(" ");
    }
    ayahs.set(`${Number(surah)}:${Number(ayah)}`, verse);
  }
  return { ayahs, license: lines.filter((l) => l.startsWith("#")).join("\n") };
}

export const loadTanzil = async (): Promise<TanzilText> => parseTanzil(await cachedText("tanzil-uthmani.txt", TANZIL_URL));

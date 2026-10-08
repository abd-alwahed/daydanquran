import { toArabicDigits } from "./arabic";
import type { PageData } from "./types";

/** "البقرة" or, for a page spanning several surahs, "الإخلاص، الفلق، الناس". */
export const surahLabel = (data: PageData): string => data.surahs.map((s) => s.name).join("، ");

/** "١" or "٢٩–٣٠". */
export const juzLabel = (data: PageData): string => data.juz.map(toArabicDigits).join("–");

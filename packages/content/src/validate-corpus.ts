import { TOTAL_AYAHS, type AyahKey, type PageData } from "@daydan/core";

/**
 * Whole-Mushaf checks for a full build: every Tanzil ayah appears exactly once,
 * in Mushaf order, on contiguous pages.
 */
export function validateCorpus(pages: readonly PageData[], tanzilOrder: readonly AyahKey[]): string[] {
  const errors: string[] = [];
  const pageOf = new Map<AyahKey, number>();
  for (const data of pages) {
    for (const { key } of data.ayahs) {
      if (pageOf.has(key)) errors.push(`${key}: مكررة في الصفحتين ${pageOf.get(key)} و${data.page}`);
      pageOf.set(key, data.page);
    }
  }
  if (pageOf.size !== TOTAL_AYAHS) errors.push(`${pageOf.size} آية بدل ${TOTAL_AYAHS}`);

  let lastPage = 0;
  for (const key of tanzilOrder) {
    const page = pageOf.get(key);
    if (page === undefined) errors.push(`${key}: غير موجودة في أي صفحة`);
    else if (page < lastPage || page > lastPage + 1) errors.push(`${key}: في الصفحة ${page} بعد الصفحة ${lastPage}`);
    else lastPage = page;
  }
  return errors;
}

/**
 * Fetches, assembles and validates Mushaf pages into content/build/pages/<n>/.
 *   pnpm --filter @daydan/content fetch          all pages
 *   pnpm --filter @daydan/content fetch 1 5      a range, for trying things out
 * Exits non-zero on any validation error.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { TOTAL_AYAHS, TOTAL_PAGES, type PageData } from "@daydan/core";
import { annotateGroupStarts, buildPage } from "../build-page";
import { BUILD_DIR, REPORT_FILE, pageDir } from "../paths";
import { QuranComSource } from "../sources/quran-com";
import { loadTanzil } from "../sources/tanzil";
import { TafsirGroups } from "../tafsir-groups";
import { validateCorpus } from "../validate-corpus";

interface Failure {
  page: number | "all";
  errors: string[];
}

function parseRange(argv: string[]): [number, number] {
  const from = Number(argv[0] ?? 1);
  const to = Number(argv[1] ?? TOTAL_PAGES);
  if (!(from >= 1 && to <= TOTAL_PAGES && from <= to)) throw new Error(`Invalid range ${from}..${to}`);
  return [from, to];
}

async function main(): Promise<void> {
  const [from, to] = parseRange(process.argv.slice(2));
  const source = await QuranComSource.create();
  console.log("المعرّفات:", source.ids);

  const tanzil = await loadTanzil();
  if (tanzil.ayahs.size !== TOTAL_AYAHS) throw new Error(`Tanzil has ${tanzil.ayahs.size} ayahs, expected ${TOTAL_AYAHS}`);
  const chapterNames = await source.chapterNames();
  const groups = new TafsirGroups((key) => source.tafsirForAyah(key));

  const failures: Failure[] = [];
  const built: { data: PageData; mushaf: Buffer }[] = [];
  for (let page = from; page <= to; page++) {
    const { data, mushaf, errors } = await buildPage(page, source, tanzil.ayahs, chapterNames, groups);
    if (errors.length) failures.push({ page, errors });
    built.push({ data, mushaf });
    process.stdout.write(`\rصفحة ${page}/${to}`);
  }
  console.log();

  const pages = built.map((b) => b.data);
  const groupErrors = annotateGroupStarts(pages, groups);
  if (groupErrors.length) failures.push({ page: "all", errors: groupErrors });
  const isFullBuild = from === 1 && to === TOTAL_PAGES;
  if (isFullBuild) {
    const corpusErrors = validateCorpus(pages, [...tanzil.ayahs.keys()]);
    if (corpusErrors.length) failures.push({ page: "all", errors: corpusErrors });
  }

  for (const { data, mushaf } of built) {
    const dir = pageDir(data.page);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "page.json"), JSON.stringify(data, null, 2));
    await fs.writeFile(path.join(dir, "mushaf.png"), mushaf);
  }
  await fs.writeFile(path.join(BUILD_DIR, "TANZIL-LICENSE.txt"), tanzil.license);

  const ayahCount = pages.reduce((n, p) => n + p.ayahs.length, 0);
  const report = {
    builtAt: new Date().toISOString(),
    range: [from, to],
    sources: { ...source.ids, tanzil: "Tanzil Uthmani 1.1", mushaf: "files.quran.app hafs/madani width_1260" },
    ayahCount,
    tafsirGroups: groups.size,
    failures,
    pages: pages.map((p) => ({
      page: p.page,
      ayahs: p.ayahs.length,
      tafsirChars: p.ayahs.reduce((n, a) => n + a.tafsir.length, 0),
    })),
  };
  await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2));

  if (failures.length) {
    console.error("❌ مشاكل:", JSON.stringify(failures, null, 2));
    process.exit(1);
  }
  console.log(`✅ ${ayahCount} آية في ${pages.length} صفحة بدون أخطاء`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

// دَيْدَن — جلب بيانات الصفحات الـ604 مرة واحدة وحفظها كملفات JSON
// المصدر: Quran.com API v4
// تشغيل: node src/fetch-pages.mjs        (كل الصفحات)
//        node src/fetch-pages.mjs 1 5    (من صفحة 1 إلى 5 للتجربة)
//
// ملاحظة: معرّفات القارئ والتفسير لا تُكتب يدوياً، بل تُستخرج من الـAPI بالاسم
// ثم تُطبع لتتأكد منها بنفسك قبل الاعتماد.

import fs from "node:fs/promises";
import path from "node:path";

const API = "https://api.quran.com/api/v4";
const AUDIO_CDN = "https://verses.quran.com/";
const OUT_DIR = "data/pages";
const TOTAL_PAGES = 604;
const TOTAL_VERSES = 6236;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.ok) return res.json();
    if (i === tries) throw new Error(`${res.status} ${url}`);
    await sleep(1000 * 2 ** i); // انتظار متزايد عند الفشل
  }
}

async function resolveIds() {
  const { recitations } = await get(`${API}/resources/recitations?language=ar`);
  // الحصري مرتّل: نستبعد المعلّم والمجوّد
  const husary = recitations.filter(
    (r) => /husary/i.test(r.reciter_name) && !/muallim|mujawwad/i.test(r.style ?? "")
  );
  const { tafsirs } = await get(`${API}/resources/tafsirs`);
  const muyassar = tafsirs.filter((t) => /muyassar|ميسر/i.test(`${t.name} ${t.slug}`));

  console.log("مرشحو الحصري:", husary.map((r) => `${r.id}:${r.reciter_name}:${r.style}`));
  console.log("مرشحو الميسر:", muyassar.map((t) => `${t.id}:${t.name}:${t.slug}`));
  if (husary.length !== 1 || muyassar.length !== 1)
    throw new Error("المطابقة غير فريدة — راجع القوائم أعلاه وحدّد المعرّف يدوياً");
  return { recitationId: husary[0].id, tafsirId: muyassar[0].id };
}

const stripHtml = (s = "") => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function fetchPage(page, { recitationId, tafsirId }) {
  const verses = [];
  for (let p = 1; ; p++) {
    const url = `${API}/verses/by_page/${page}?language=ar&words=false&per_page=50&page=${p}` +
      `&fields=text_uthmani,chapter_id&tafsirs=${tafsirId}&audio=${recitationId}`;
    const data = await get(url);
    verses.push(...data.verses);
    if (!data.pagination?.next_page) break;
  }
  return {
    page,
    verses: verses.map((v) => ({
      key: v.verse_key,
      surah: Number(v.verse_key.split(":")[0]),
      text: v.text_uthmani,
      tafsir: stripHtml(v.tafsirs?.[0]?.text),
      audio: v.audio?.url ? new URL(v.audio.url, AUDIO_CDN).href : null,
    })),
  };
}

function validate(pageData) {
  const errs = [];
  if (!pageData.verses.length) errs.push("صفحة فارغة");
  for (const v of pageData.verses) {
    if (!v.text) errs.push(`${v.key}: نص مفقود`);
    if (!v.tafsir) errs.push(`${v.key}: تفسير مفقود`);
    if (!v.audio) errs.push(`${v.key}: صوت مفقود`);
  }
  return errs;
}

async function main() {
  const from = Number(process.argv[2] ?? 1);
  const to = Number(process.argv[3] ?? TOTAL_PAGES);
  await fs.mkdir(OUT_DIR, { recursive: true });
  const ids = await resolveIds();
  console.log("المعرّفات المعتمدة:", ids);

  let verseCount = 0, failed = [];
  for (let page = from; page <= to; page++) {
    const data = await fetchPage(page, ids);
    const errs = validate(data);
    if (errs.length) failed.push({ page, errs });
    verseCount += data.verses.length;
    await fs.writeFile(path.join(OUT_DIR, `${page}.json`), JSON.stringify(data, null, 2));
    process.stdout.write(`\rصفحة ${page}/${to} — آيات حتى الآن: ${verseCount}`);
    await sleep(300); // تخفيف الضغط على الـAPI
  }
  console.log();

  if (from === 1 && to === TOTAL_PAGES && verseCount !== TOTAL_VERSES)
    failed.push({ page: "all", errs: [`عدد الآيات ${verseCount} بدل ${TOTAL_VERSES}`] });
  if (failed.length) {
    console.error("❌ مشاكل:", JSON.stringify(failed, null, 2));
    process.exit(1);
  }
  console.log("✅ تم بدون أخطاء");
}

main().catch((e) => { console.error(e); process.exit(1); });

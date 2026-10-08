"""
ديمة — الفحص الشامل لتسجيل التفسير الميسر (عطيف + أيوب) لكل السور.
لكل سورة: تنزيل التسجيل + آيات أيوب، ثم التقطيع وكشف التكرار، ثم حفظ النتيجة.
قابل للإيقاف والاستئناف: السور المفحوصة سابقاً لا تُعاد.

الاستخدام (من مجلد فيه segment_surah.py):
  python scan_all.py --surahs 78-114          (جزء عمّ أولاً — نتيجة سريعة)
  python scan_all.py                          (كل السور)
  python scan_all.py --surahs 2 --delete-audio  (يحذف ملف التفسير بعد فحصه لتوفير المساحة)
  python scan_all.py --summary                (طباعة الملخص فقط من النتائج المحفوظة)
"""
import argparse, csv, json, os, re, sys, time, traceback, urllib.request

from segment_surah import analyze

ITEM = "ar-002-tafceer-moyassar-mohamed-ayoub"
META_URL = f"https://archive.org/metadata/{ITEM}"
DL_URL = f"https://archive.org/download/{ITEM}/" + "{name}"
AYAH_URL = "https://everyayah.com/data/Muhammad_Ayyoub_64kbps/{s:03d}{a:03d}.mp3"
DATA, TAFSIR_DIR, AYYUB_DIR, RESULTS = "data", "data/tafsir", "data/ayyub_64", "data/results"
DUP_MAX_DISTANCE = 10  # نقارن كل مقطع بالمقاطع العشرة التالية فقط (التكرار المرصود كان متجاوراً)

AYAH_COUNTS = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
               112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89,
               59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30,
               52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15,
               21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6]
assert len(AYAH_COUNTS) == 114 and sum(AYAH_COUNTS) == 6236


def download(url, path, tries=4):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return
    for i in range(1, tries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "deema-scan/1.0"})
            with urllib.request.urlopen(req, timeout=300) as r, open(path + ".part", "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            os.replace(path + ".part", path)
            return
        except Exception as e:
            if i == tries:
                raise RuntimeError(f"فشل تنزيل {url}: {e}")
            time.sleep(3 * i)


def tafsir_file_map():
    """أسماء الملفات من بيانات الأرشيف نفسها بدل تخمينها."""
    with urllib.request.urlopen(urllib.request.Request(META_URL, headers={"User-Agent": "deema-scan/1.0"}), timeout=60) as r:
        meta = json.load(r)
    m = {}
    for f in meta.get("files", []):
        hit = re.match(r"ar-(\d{3})-tafceer.*\.mp3$", f["name"])
        if hit:
            m[int(hit.group(1))] = f["name"]
    return m


def parse_surahs(spec):
    out = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        out += range(int(a), int(b or a) + 1)
    if any(not 1 <= s <= 114 for s in out):
        sys.exit("أرقام السور يجب أن تكون بين 1 و114")
    return out


def summarize():
    rows = []
    for f in sorted(os.listdir(RESULTS)):
        if f.endswith(".json"):
            r = json.load(open(os.path.join(RESULTS, f), encoding="utf-8"))
            rows.append(r)
    ok = [r for r in rows if "error" not in r]
    errs = [r for r in rows if "error" in r]
    n_ayahs = sum(len(r["ayahs"]) for r in ok)
    n_def = sum(len(r["defective_ayahs"]) for r in ok)
    n_susp = sum(len(r["suspicious_ayahs"]) for r in ok)
    with open(os.path.join(DATA, "summary.csv"), "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["surah", "ayahs", "defective", "defective_pct", "suspicious", "verdict_ok", "defective_list", "error"])
        for r in rows:
            if "error" in r:
                w.writerow([r["surah"], "", "", "", "", "", "", r["error"]]); continue
            n = len(r["ayahs"])
            w.writerow([r["surah"], n, len(r["defective_ayahs"]), round(100 * len(r["defective_ayahs"]) / n, 1),
                        len(r["suspicious_ayahs"]), r["verdict"].startswith("الفرضية صامدة"),
                        " ".join(map(str, r["defective_ayahs"])), ""])

    print("\n==================== ملخص الفحص الشامل ====================")
    print(f"سور مفحوصة: {len(ok)} | أخطاء: {len(errs)}")
    if n_ayahs:
        print(f"آيات: {n_ayahs} | تفسير مكرر (معيب): {n_def} ({100 * n_def / n_ayahs:.1f}%) | مطابقة مشكوك فيها: {n_susp}")
        rejected = [r["surah"] for r in ok if not r["verdict"].startswith("الفرضية صامدة")]
        if rejected:
            print("⚠️ سور رُفضت فيها الفرضية (التلاوة لا تطابق أيوب):", rejected)
        worst = sorted(ok, key=lambda r: -len(r["defective_ayahs"]) / len(r["ayahs"]))[:10]
        print("أعلى السور عيباً:", [(r["surah"], f"{100 * len(r['defective_ayahs']) / len(r['ayahs']):.0f}%") for r in worst if r["defective_ayahs"]])
    for r in errs:
        print(f"❌ سورة {r['surah']}: {r['error']}")
    print(f"التفاصيل: {os.path.join(DATA, 'summary.csv')}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--surahs", default="1-114")
    ap.add_argument("--delete-audio", action="store_true")
    ap.add_argument("--summary", action="store_true")
    ap.add_argument("--offline", action="store_true", help="بدون تنزيل — يستخدم الملفات الموجودة فقط")
    a = ap.parse_args()
    for d in (TAFSIR_DIR, AYYUB_DIR, RESULTS):
        os.makedirs(d, exist_ok=True)
    if a.summary:
        return summarize()

    surahs = parse_surahs(a.surahs)
    fmap = {} if a.offline else tafsir_file_map()
    if not a.offline and len(fmap) != 114:
        print(f"⚠️ وُجد {len(fmap)} ملف تفسير فقط في الأرشيف بدل 114")

    t0 = time.time()
    for i, s in enumerate(surahs, 1):
        res_path = os.path.join(RESULTS, f"{s:03d}.json")
        if os.path.exists(res_path) and "error" not in json.load(open(res_path, encoding="utf-8")):
            continue  # مفحوصة بنجاح سابقاً — السور التي فشلت تُعاد
        tafsir_path = os.path.join(TAFSIR_DIR, f"{s:03d}.mp3")
        print(f"[{i}/{len(surahs)}] سورة {s} ({AYAH_COUNTS[s - 1]} آية) ...", flush=True)
        try:
            if not a.offline:
                if s not in fmap:
                    raise RuntimeError("ملف التفسير غير موجود في الأرشيف")
                download(DL_URL.format(name=fmap[s]), tafsir_path)
                for ay in range(1, AYAH_COUNTS[s - 1] + 1):
                    download(AYAH_URL.format(s=s, a=ay), os.path.join(AYYUB_DIR, f"{s:03d}{ay:03d}.mp3"))
            have = len([f for f in os.listdir(AYYUB_DIR) if f.startswith(f"{s:03d}") and f.endswith(".mp3")])
            if have != AYAH_COUNTS[s - 1]:
                print(f"   ⚠️ آيات أيوب الموجودة {have} من {AYAH_COUNTS[s - 1]}")
            report, _ = analyze(tafsir_path, AYYUB_DIR, s, dup_max_distance=DUP_MAX_DISTANCE)
            print(f"   معيبة: {report['defective_ayahs'] or 'لا شيء'} | مشكوك: {report['suspicious_ayahs'] or 'لا شيء'}")
            if a.delete_audio and not a.offline:
                os.remove(tafsir_path)
        except Exception as e:
            report = {"surah": s, "error": str(e)}
            print("   ❌", e)
            traceback.print_exc(limit=1)
        with open(res_path, "w", encoding="utf-8") as fh:
            json.dump(report, fh, ensure_ascii=False, indent=2)
        print(f"   الوقت المنقضي: {(time.time() - t0) / 60:.1f} دقيقة", flush=True)
    summarize()


if __name__ == "__main__":
    main()

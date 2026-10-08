"""
ديمة — فحص النسخة الثانية (lamaisondelislam) من تسجيل التفسير الميسر لسورة معيّنة.
ينزّل ملف السورة، يشغّل segment_surah.py عليه، ويطبع خلاصة: الحكم + التكرارات.

الاستخدام (من نفس المجلد الذي فيه segment_surah.py ومجلد ayyub_64):
  python check_source_b.py                 (سورة الملك 67، تلاوة ayyub_64)
  python check_source_b.py 67 ayyub_128
  python check_source_b.py 67 ayyub_64 --local ملف.mp3   (بدون تنزيل — للاختبار)
"""
import json, os, subprocess, sys, urllib.request

args = [a for a in sys.argv[1:]]
local = None
if "--local" in args:
    i = args.index("--local"); local = args[i + 1]; del args[i:i + 2]
SURAH = int(args[0]) if args else 67
AYAH_DIR = args[1] if len(args) > 1 else "ayyub_64"

URL = ("https://archive.org/download/ar-002-tafceer-moyassar-mohamed-ayoub/"
       f"ar-{SURAH:03d}-tafceer-moyassar-mohamed-ayoub.mp3")
here = os.path.dirname(os.path.abspath(__file__))
mp3 = local or f"tafsir_{SURAH:03d}_b.mp3"
out_json, cuts = f"out_{SURAH:03d}_b.json", f"cuts_{SURAH:03d}_b"

if not os.path.isdir(AYAH_DIR) or not any(f.startswith(f"{SURAH:03d}") for f in os.listdir(AYAH_DIR)):
    sys.exit(f"لا توجد آيات السورة {SURAH} في المجلد {AYAH_DIR} — شغّل download_test_data.py أولاً")

if not local and not (os.path.exists(mp3) and os.path.getsize(mp3) > 0):
    print("تنزيل:", URL)
    req = urllib.request.Request(URL, headers={"User-Agent": "deema-feasibility/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r, open(mp3, "wb") as f:
        f.write(r.read())
    print(f"تم: {mp3} ({os.path.getsize(mp3) / 1e6:.1f} MB)")

print("تشغيل التقطيع...")
res = subprocess.run([sys.executable, os.path.join(here, "segment_surah.py"),
                      mp3, AYAH_DIR, str(SURAH), out_json, "--cut", cuts])
if res.returncode != 0:
    sys.exit("فشل التقطيع — أرسل الخطأ أعلاه")

rep = json.load(open(out_json, encoding="utf-8"))
if "duplicate_tafsir" not in rep:
    sys.exit("نسخة segment_surah.py قديمة (بلا كشف التكرار) — استبدلها بالنسخة المحدّثة")
print("\n================ الخلاصة (النسخة الثانية) ================")
print("المدة:", round(rep["duration_s"] / 60, 2), "دقيقة")
print("الحكم:", rep["verdict"])
if rep["duplicate_tafsir"]:
    print("❌ النسخة الثانية فيها تكرار أيضاً:")
    for d in rep["duplicate_tafsir"]:
        print(f"   مقطع الآيات {d['repeat']} = مقطع الآيات {d['first']} (تشابه {d['similarity']})")
else:
    print("✅ لا تكرار في النسخة الثانية — استمع للتأكيد إلى:")
    for g in rep["groups"]:
        if any(a in (19, 20, 21) for a in g["ayahs"]) or SURAH != 67:
            print("  ", os.path.join(cuts, f"{SURAH:03d}_{g['ayahs'][0]:03d}-{g['ayahs'][-1]:03d}.wav"))

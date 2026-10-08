"""
ديمة — تنزيل بيانات اختبار الجدوى لسورة الملك (67)، يعمل على ويندوز وماك ولينكس.

1) تسجيل التفسير الميسر (عطيف + تلاوة أيوب) للسورة كاملة — أرشيف الإنترنت (~9 ميغابايت)
2) تلاوة محمد أيوب آية آية (30 آية) — everyayah.com

الاستخدام:
  python download_test_data.py            (جودة 128kbps)
  python download_test_data.py 64         (جودة 64kbps — جرّبها إن رفض الاختبار الأول الفرضية)
"""
import os, sys, urllib.request

SURAH, AYAHS = 67, 30
QUALITY = sys.argv[1] if len(sys.argv) > 1 else "128"
TAFSIR_URL = f"https://archive.org/download/002_20200606_202zzzzzzzzzzzzzzzzzzzzzzz/{SURAH:03d}.mp3"
AYAH_URL = "https://everyayah.com/data/Muhammad_Ayyoub_{q}kbps/{s:03d}{a:03d}.mp3"


def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        print("موجود:", path); return
    req = urllib.request.Request(url, headers={"User-Agent": "deema-feasibility/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
        f.write(r.read())
    print(f"تم: {path} ({os.path.getsize(path) / 1e6:.1f} MB)")


fetch(TAFSIR_URL, f"tafsir_{SURAH:03d}.mp3")
out_dir = f"ayyub_{QUALITY}"
os.makedirs(out_dir, exist_ok=True)
for a in range(1, AYAHS + 1):
    fetch(AYAH_URL.format(q=QUALITY, s=SURAH, a=a), os.path.join(out_dir, f"{SURAH:03d}{a:03d}.mp3"))

n = len([f for f in os.listdir(out_dir) if f.endswith(".mp3")])
print(f"\nاكتمل: ملف التفسير + {n}/{AYAHS} آية في {out_dir}/")

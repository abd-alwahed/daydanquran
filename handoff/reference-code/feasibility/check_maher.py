"""
ديمة — فحص الإصدار الرسمي الأحدث (2022): التفسير الميسر بصوت د. علي عطيف مصحوباً بتلاوة ماهر المعيقلي.
نفحص سورة الملك تحديداً لأننا نعرف مواضع العيب في إصدار أيوب: تفسير الآيات 17 و20 و21 و24 و26 مكرر.

الاستخدام:
  1) نزّل ملف سورة الملك يدوياً من صفحة الإصدار على طريق الإسلام وسمّه maher_067.mp3
  2) python check_maher.py maher_067.mp3
السكربت ينزّل آيات المعيقلي من everyayah ويجرب أكثر من اسم مجلد محتمل.
"""
import os, sys, urllib.request
from segment_surah import analyze, cut_segments

SURAH, AYAHS = 67, 30
KNOWN_DEFECTS_AYYUB = {17, 20, 21, 24, 26}
CANDIDATE_FOLDERS = ["MaherAlMuaiqly128kbps", "Maher_AlMuaiqly_64kbps"]  # غير متحقق منها — نجرب بالترتيب


def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return True
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "deema-feasibility/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        if len(data) < 1000:  # صفحة خطأ وليست ملفاً صوتياً
            return False
        open(path, "wb").write(data)
        return True
    except Exception:
        return False


def main():
    if len(sys.argv) < 2 or not os.path.exists(sys.argv[1]):
        sys.exit("أعطني مسار ملف سورة الملك من إصدار المعيقلي: python check_maher.py maher_067.mp3")
    out_dir = "maher_ayahs"
    os.makedirs(out_dir, exist_ok=True)

    folder = next((f for f in CANDIDATE_FOLDERS
                   if get(f"https://everyayah.com/data/{f}/067001.mp3", os.path.join(out_dir, "067001.mp3"))), None)
    if not folder:
        sys.exit("لم أجد آيات المعيقلي على everyayah بالأسماء المتوقعة — أرسل لي هذه الرسالة")
    print("مجلد التلاوة:", folder)
    for a in range(2, AYAHS + 1):
        if not get(f"https://everyayah.com/data/{folder}/{SURAH:03d}{a:03d}.mp3", os.path.join(out_dir, f"{SURAH:03d}{a:03d}.mp3")):
            sys.exit(f"فشل تنزيل الآية {a}")

    report, y = analyze(sys.argv[1], out_dir, SURAH)
    cut_segments(y, report, "cuts_maher")
    found = set(report["defective_ayahs"])
    print("\n============ إصدار المعيقلي — سورة الملك ============")
    print("المدة:", round(report["duration_s"] / 60, 2), "دقيقة")
    print("الحكم:", report["verdict"])
    print("مشكوك في مطابقتها:", report["suspicious_ayahs"] or "لا شيء")
    print("آيات تفسيرها مكرر:", sorted(found) or "لا شيء")
    fixed = KNOWN_DEFECTS_AYYUB - found
    print(f"من عيوب إصدار أيوب الخمسة: {len(fixed)} سليمة هنا {sorted(fixed)} | {len(KNOWN_DEFECTS_AYYUB & found)} ما زالت معيبة")
    if not report["verdict"].startswith("الفرضية صامدة"):
        print("⚠️ المطابقة فشلت — قد تكون تلاوة المعيقلي في الإصدار تسجيلاً مختلفاً عن ملفات everyayah")


if __name__ == "__main__":
    main()

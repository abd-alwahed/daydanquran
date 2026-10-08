"""
ديمة — اختبار جدوى: استخراج مقاطع تفسير د. علي عطيف من تسجيل "التفسير الميسر مع تلاوة محمد أيوب".

الفكرة: نبحث عن كل آية (من ملفات أيوب المنفصلة) داخل التسجيل الطويل بمطابقة صوتية
(ارتباط متقاطع على log-mel، بلا تمديد زمني). ما يقع بين نهاية آية وبداية التالية = تفسير.
إن كانت الفجوة شبه معدومة فالآيتان ضمن مجموعة واحدة تُفسَّر معاً.

الافتراض الحرج (يُختبر بهذا السكربت): تلاوة أيوب داخل تسجيل التفسير هي نفس تسجيل
مصحف أيوب المنفصل. إن لم تكن كذلك ستكون قمم المطابقة مسطحة (peak_z منخفض) لكل الآيات.

الاستخدام:
  python segment_surah.py <combined.mp3> <ayah_dir> <surah_no> <out.json> [--cut out_dir]
  ayah_dir فيه ملفات بصيغة SSSAAA.mp3 (مثل 067001.mp3) كما في everyayah.
"""
import argparse, json, os, sys
import numpy as np
import librosa

SR = 16000
HOP = 320                       # 20ms لكل إطار
FRAME_S = HOP / SR
MAX_SEARCH_S = 20 * 60          # أقصى بُعد نبحث فيه عن الآية التالية
GROUP_GAP_S = 1.5               # فجوة أقصر من هذا = لا تفسير بين الآيتين
Z_WARN = 4.5                    # حدّة القمة أقل من هذا = مطابقة مشكوك فيها (معايرة مبدئية على بيانات صناعية فقط)


def features(y):
    """log-mel مطبّعة لكل إطار (متجه وحدة) — لا تطبيع على مستوى الملف كي تبقى المقارنة عادلة."""
    m = librosa.power_to_db(librosa.feature.melspectrogram(y=y, sr=SR, n_fft=1024, hop_length=HOP, n_mels=64))
    m = m - m.mean(axis=0, keepdims=True)
    return m / (np.linalg.norm(m, axis=0, keepdims=True) + 1e-8)


def locate(ref_f, long_f, start_frame):
    """مطابقة صلبة بلا تمديد زمني: تفترض أن التلاوة هي نفس التسجيل حرفياً.
    تعيد (بداية، نهاية، حدّة القمة). حدّة القمة = (أعلى تشابه - الوسيط) / الانحراف المعياري:
    نفس التسجيل يعطي قمة حادة واحدة، وتسجيل مختلف يعطي منحنى مسطحاً."""
    from scipy.signal import fftconvolve
    end_limit = min(long_f.shape[1], start_frame + int(MAX_SEARCH_S / FRAME_S))
    window = long_f[:, start_frame:end_limit]
    K = ref_f.shape[1]
    if window.shape[1] < K:
        return None
    score = sum(fftconvolve(window[b], ref_f[b][::-1], mode="valid") for b in range(ref_f.shape[0])) / K
    best = int(np.argmax(score))
    z = (score[best] - np.median(score)) / (score.std() + 1e-8)
    return start_frame + best, start_frame + best + K, float(z)


DUP_LEN_TOL_S = 1.0             # مقطعان بفارق طول أقل من هذا يُفحصان كتكرار محتمل
DUP_SIM = 0.90                  # تشابه أعلى من هذا = نفس الصوت مكرر


DUP_MAX_LAG_S = 3.0             # نسمح بإزاحة حتى 3 ثوانٍ بين النسختين (حدود القص لا تتطابق بالضرورة)


def _best_lag_similarity(A, B, max_lag):
    """أعلى متوسط تشابه بين مقطعين عبر كل الإزاحات ضمن ±max_lag إطار.
    corr[nB-1+lag] = Σ A[:, t+lag]·B[:, t] — كل الإزاحات تُحسب دفعة واحدة بـFFT."""
    from scipy.signal import fftconvolve
    nA, nB = A.shape[1], B.shape[1]
    corr = sum(fftconvolve(A[k], B[k][::-1], mode="full") for k in range(A.shape[0]))
    best = -1.0
    for lag in range(-max_lag, max_lag + 1):
        n = min(nA - lag, nB) if lag >= 0 else min(nA, nB + lag)
        if n < 50:  # أقل من ثانية تداخل = غير معتبر
            continue
        best = max(best, float(corr[nB - 1 + lag] / n))
    return best


def find_duplicates(long_f, groups, max_distance=None):
    """يكشف مقاطع التفسير المكررة داخل التسجيل (عيب في الملف المصدر نفسه).
    يقارن كل زوج متقارب الطول مع السماح بإزاحة زمنية، لأن القص قد لا يبدأ من نفس الجزء من الثانية."""
    segs = [(g["ayahs"], int(g["tafsir"][0] / FRAME_S), int(g["tafsir"][1] / FRAME_S)) for g in groups]
    max_lag = int(DUP_MAX_LAG_S / FRAME_S)
    dups = []
    for i in range(len(segs)):
        last = len(segs) if max_distance is None else min(len(segs), i + 1 + max_distance)
        for j in range(i + 1, last):
            (ai, si, ei), (aj, sj, ej) = segs[i], segs[j]
            if abs((ei - si) - (ej - sj)) * FRAME_S > DUP_LEN_TOL_S + DUP_MAX_LAG_S:
                continue
            sim = _best_lag_similarity(long_f[:, si:ei], long_f[:, sj:ej], max_lag)
            if sim > DUP_SIM:
                dups.append({"first": ai, "repeat": aj, "similarity": round(sim, 3)})
    return dups


def analyze(combined, ayah_dir, surah, dup_max_distance=None):
    """يحلل سورة واحدة ويعيد (التقرير، الإشارة الصوتية). يرفع ValueError عند الفشل."""
    y, _ = librosa.load(combined, sr=SR, mono=True)
    long_f = features(y)
    ayah_files = sorted(f for f in os.listdir(ayah_dir) if f.startswith(f"{surah:03d}") and f.endswith(".mp3"))
    if not ayah_files:
        raise ValueError(f"لا توجد ملفات آيات للسورة {surah} في {ayah_dir}")

    hits, cursor = [], 0
    for f in ayah_files:
        ref, _ = librosa.load(os.path.join(ayah_dir, f), sr=SR, mono=True)
        r = locate(features(ref), long_f, cursor)
        if r is None:
            raise ValueError(f"لم تُعثر على {f} — انتهى التسجيل قبل الآيات")
        s, e, c = r
        hits.append({"ayah": int(f[3:6]), "start": round(s * FRAME_S, 2),
                     "end": round(e * FRAME_S, 2), "peak_z": round(c, 2),
                     "suspicious": c < Z_WARN})
        cursor = e + 1

    total = len(y) / SR
    groups, cur = [], [hits[0]]
    for prev, nxt in zip(hits, hits[1:] + [None]):
        gap_end = nxt["start"] if nxt else total
        if nxt and gap_end - prev["end"] < GROUP_GAP_S:
            cur.append(nxt); continue
        groups.append({"ayahs": [h["ayah"] for h in cur],
                       "recitation": [cur[0]["start"], prev["end"]],
                       "tafsir": [prev["end"], round(gap_end, 2)],
                       "suspicious": any(h["suspicious"] for h in cur)})
        if nxt: cur = [nxt]

    report = {"surah": surah, "duration_s": round(total, 2),
              "intro_s": hits[0]["start"], "ayahs": hits, "groups": groups,
              "suspicious_ayahs": [h["ayah"] for h in hits if h["suspicious"]]}
    report["duplicate_tafsir"] = find_duplicates(long_f, groups, dup_max_distance)
    # الآيات التي تفسيرها الصوتي نسخة من تفسير سابق = معيبة
    report["defective_ayahs"] = sorted({a for d in report["duplicate_tafsir"] for a in d["repeat"]})
    ratio = len(report["suspicious_ayahs"]) / len(hits)
    report["verdict"] = ("الفرضية مرفوضة: التلاوة على الأرجح ليست نفس تسجيل أيوب المنفصل — ننتقل لتمييز المتكلم"
                         if ratio > 0.2 else "الفرضية صامدة: المطابقة الصلبة صالحة — راجع المقاطع المشكوك فيها فقط")
    return report, y


def cut_segments(y, report, cut_dir):
    import soundfile as sf
    os.makedirs(cut_dir, exist_ok=True)
    for g in report["groups"]:
        s, e = (int(t * SR) for t in g["tafsir"])
        name = f"{report['surah']:03d}_{g['ayahs'][0]:03d}-{g['ayahs'][-1]:03d}.wav"
        sf.write(os.path.join(cut_dir, name), y[s:e], SR)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("combined"); ap.add_argument("ayah_dir")
    ap.add_argument("surah", type=int); ap.add_argument("out")
    ap.add_argument("--cut", help="مجلد لحفظ مقاطع التفسير المقصوصة")
    a = ap.parse_args()
    try:
        report, y = analyze(a.combined, a.ayah_dir, a.surah)
    except ValueError as e:
        sys.exit(str(e))
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
    if a.cut:
        cut_segments(y, report, a.cut)

    print(f"آيات: {len(report['ayahs'])} | مجموعات تفسير: {len(report['groups'])} | مشكوك فيها: {report['suspicious_ayahs']}")
    print("الحكم:", report["verdict"])
    for d in report["duplicate_tafsir"]:
        print(f"⚠️ تفسير مكرر: مقطع الآيات {d['repeat']} نسخة من مقطع الآيات {d['first']} (تشابه {d['similarity']}) — عيب في الملف المصدر")


if __name__ == "__main__":
    main()

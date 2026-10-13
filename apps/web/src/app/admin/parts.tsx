import { juzLabel, surahLabel, toArabicDigits, type PageCards, type PageData } from "@daydan/core";
import buttons from "@/components/button.module.css";
import { RecitationPlayer } from "@/components/recitation-player";
import { setApproval } from "./actions";
import styles from "./admin.module.css";
import { ImageViewer } from "./image-viewer";
import { fileUrl, type PageReview } from "./review";

/** One generated image at its own aspect ratio, never cropped. */
export function Asset({
  page,
  file,
  label,
  mushaf = false,
}: {
  page: number;
  file: string;
  label: string;
  mushaf?: boolean;
}) {
  return (
    <figure className={mushaf ? styles.mushaf : styles.asset}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local review of the exact rendered file */}
      <img src={fileUrl(page, file)} alt={label} loading="lazy" data-viewable="1" />
      <figcaption>
        {label} ·{" "}
        <a href={fileUrl(page, file)} download={`daydan-p${page}-${file}`}>
          تنزيل
        </a>
      </figcaption>
    </figure>
  );
}

/** The images posted by hand (WhatsApp, Instagram, Facebook): click to view, each with its download link. */
export function Downloads({ page, cards }: { page: number; cards: PageCards }) {
  const files = [
    { file: cards.post, label: "المنشور" },
    { file: cards.story, label: "الستوري" },
    ...cards.tafsir.map((file, i) => ({ file, label: `بطاقة التفسير ${toArabicDigits(i + 1)}` })),
  ];
  return (
    <ImageViewer>
      <div className={styles.assets}>
        {files.map(({ file, label }) => (
          <Asset key={file} page={page} file={file} label={label} />
        ))}
      </div>
    </ImageViewer>
  );
}

export function ApprovalStatus({ approved }: { approved: boolean }) {
  return (
    <span className={approved ? styles.approved : styles.pending}>
      {approved ? "معتمدة" : "بانتظار المراجعة"}
    </span>
  );
}

export function ApprovalForm({ page, approved }: { page: number; approved: boolean }) {
  return (
    <form action={setApproval.bind(null, page, !approved)} className={styles.approval}>
      <ApprovalStatus approved={approved} />
      <button type="submit" className={approved ? buttons.button : buttons.primary}>
        {approved ? "سحب الاعتماد" : "اعتماد الصفحة"}
      </button>
    </form>
  );
}

/** The reasons a page needs a closer look, shown above its files. */
export function ReviewFlags({ flags }: { flags: readonly string[] }) {
  if (!flags.length) return null;
  return (
    <div className={styles.flags}>
      <strong>تحتاج تدقيقاً أكثر:</strong>
      <ul>
        {flags.map((flag) => (
          <li key={flag}>{flag}</li>
        ))}
      </ul>
    </div>
  );
}

export function PageSummary({ data }: { data: PageData }) {
  return (
    <p>
      {/* «،» not «·»: next to Arabic-Indic digits a middle dot reads as the zero «٠». */}
      سورة {surahLabel(data)}، الجزء {juzLabel(data)}، {toArabicDigits(data.ayahs.length)} آية
    </p>
  );
}

/** Every file generated for one page, as the reviewer must see it before approving. */
export function PageAssets({ review: { data, cards, caption } }: { review: PageReview }) {
  const page = data.page;
  return (
    <ImageViewer>
      <section className={styles.section}>
        <h2>صفحة المصحف</h2>
        <Asset page={page} file={cards.mushaf} label="صفحة المصحف" mushaf />
      </section>

      <section className={styles.section}>
        <h2>التلاوة</h2>
        <RecitationPlayer tracks={data.ayahs.map((a) => a.audio)} />
      </section>

      <section className={styles.section}>
        <h2>المنشور والستوري</h2>
        <div className={styles.assets}>
          <Asset page={page} file={cards.post} label="المنشور ١٠٨٠×١٣٥٠" />
          <Asset page={page} file={cards.story} label="الستوري ١٠٨٠×١٩٢٠" />
        </div>
        <p className={styles.note}>ستوري التذكير المسائي صورة واحدة لكل الأيام، في الشاشة الرئيسية للمراجعة.</p>
      </section>

      <section className={styles.section}>
        <h2>بطاقات التفسير ({toArabicDigits(cards.tafsir.length)})</h2>
        <div className={styles.assets}>
          {cards.tafsir.map((file, i) => (
            <Asset key={file} page={page} file={file} label={`بطاقة ${toArabicDigits(i + 1)}`} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>نص المنشور</h2>
        <textarea className={styles.text} readOnly value={caption} aria-label="نص المنشور" />
      </section>
    </ImageViewer>
  );
}

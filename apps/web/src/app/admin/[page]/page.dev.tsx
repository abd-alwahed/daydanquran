import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { juzLabel, surahLabel, toArabicDigits } from "@daydan/core";
import { readBuiltPages } from "@daydan/content";
import { RecitationPlayer } from "@/components/recitation-player";
import styles from "../admin.module.css";
import { Asset, ApprovalForm } from "../parts";
import { readReview } from "../review";

export const metadata: Metadata = { title: "مراجعة صفحة", robots: { index: false } };

interface Props {
  params: Promise<{ page: string }>;
}

/** Every file generated for one page, side by side, with the approve / withdraw decision. */
export default async function ReviewPage({ params }: Props) {
  const page = Number((await params).page);
  const built = await readBuiltPages();
  if (!built.includes(page)) notFound();
  const { data, cards, caption, approved } = await readReview(page);
  const index = built.indexOf(page);
  const previous = built[index - 1];
  const next = built[index + 1];

  return (
    <article>
      <p>
        <Link href="/admin/">كل الصفحات</Link>
      </p>
      <h1>الصفحة {toArabicDigits(page)}</h1>
      <p>
        سورة {surahLabel(data)} · الجزء {juzLabel(data)} · {toArabicDigits(data.ayahs.length)} آية
      </p>
      <ApprovalForm page={page} approved={approved} />

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
        <p className={styles.note}>ستوري التذكير المسائي لا يُولَّد في هذه المرحلة.</p>
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

      <ApprovalForm page={page} approved={approved} />

      <nav className={styles.pager} aria-label="التنقل بين الصفحات المولّدة">
        {previous ? <Link href={`/admin/${previous}/`}>الصفحة {toArabicDigits(previous)}</Link> : <span />}
        {next ? <Link href={`/admin/${next}/`}>الصفحة {toArabicDigits(next)}</Link> : <span />}
      </nav>
    </article>
  );
}

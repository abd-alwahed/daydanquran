import type { Metadata } from "next";
import Link from "next/link";
import { TOTAL_PAGES, toArabicDigits } from "@daydan/core";
import { nextToReview, readApprovedPages, readBuiltPages, readFlaggedPages } from "@daydan/content";
import buttons from "@/components/button.module.css";
import { approveAndNext } from "../actions";
import styles from "../admin.module.css";
import { PageAssets, PageSummary, ReviewFlags } from "../parts";
import { queueUrl, readReview } from "../review";

export const metadata: Metadata = { title: "طابور المراجعة", robots: { index: false } };

interface Props {
  searchParams: Promise<{ after?: string; flagged?: string }>;
}

/** One unapproved page at a time, in reading order: approve it and move on, or skip it for later. */
export default async function ReviewQueue({ searchParams }: Props) {
  const params = await searchParams;
  const after = Math.max(0, Number(params.after) || 0);
  const flagged = params.flagged === "1";
  const [allBuilt, approved] = await Promise.all([readBuiltPages(), readApprovedPages()]);
  const built = flagged ? [...(await readFlaggedPages()).keys()] : allBuilt;
  const page = nextToReview(built, approved, after);
  const title = flagged ? "طابور الصفحات الشاذة" : "طابور المراجعة";
  const progress = (
    <p className={styles.note}>
      المعتمد: {toArabicDigits(approved.length)} من {toArabicDigits(TOTAL_PAGES)} صفحة ·{" "}
      {flagged ? (
        <Link href={queueUrl(after)}>كل الصفحات</Link>
      ) : (
        <Link href={queueUrl(0, true)}>الصفحات الشاذة فقط</Link>
      )}
    </p>
  );

  if (page === undefined) {
    const remaining = nextToReview(built, approved);
    return (
      <article>
        <p>
          <Link href="/admin/">كل الصفحات</Link>
        </p>
        <h1>{title}</h1>
        {progress}
        {remaining === undefined ? (
          <p>لا توجد صفحات بانتظار المراجعة هنا.</p>
        ) : (
          <p>
            انتهى الطابور حتى آخر صفحة. بقيت صفحات تخطّيتها،{" "}
            <Link href={queueUrl(0, flagged)}>ابدأ من أولها</Link>.
          </p>
        )}
      </article>
    );
  }

  const review = await readReview(page);
  const actions = (
    <div className={styles.approval}>
      <form action={approveAndNext.bind(null, page, flagged)}>
        <button type="submit" className={buttons.primary}>
          اعتمد وانتقل للتالية
        </button>
      </form>
      <Link className={buttons.button} href={queueUrl(page, flagged)}>
        تخطَّ
      </Link>
    </div>
  );

  return (
    <article>
      <p>
        <Link href="/admin/">كل الصفحات</Link>
      </p>
      <h1>
        {title}: الصفحة {toArabicDigits(page)}
      </h1>
      {progress}
      <PageSummary data={review.data} />
      <ReviewFlags flags={review.flags} />
      {actions}
      <PageAssets review={review} />
      {actions}
    </article>
  );
}

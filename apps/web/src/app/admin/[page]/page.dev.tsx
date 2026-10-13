import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toArabicDigits } from "@daydan/core";
import { readBuiltPages } from "@daydan/content";
import styles from "../admin.module.css";
import { ApprovalForm, PageAssets, PageSummary, ReviewFlags } from "../parts";
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
  const review = await readReview(page);
  const { data, approved } = review;
  const index = built.indexOf(page);
  const previous = built[index - 1];
  const next = built[index + 1];

  return (
    <article>
      <p>
        <Link href="/admin/">كل الصفحات</Link>
      </p>
      <h1>الصفحة {toArabicDigits(page)}</h1>
      <PageSummary data={data} />
      <ReviewFlags flags={review.flags} />
      <ApprovalForm page={page} approved={approved} />

      <PageAssets review={review} />

      <ApprovalForm page={page} approved={approved} />

      <nav className={styles.pager} aria-label="التنقل بين الصفحات المولّدة">
        {previous ? <Link href={`/admin/${previous}/`}>الصفحة {toArabicDigits(previous)}</Link> : <span />}
        {next ? <Link href={`/admin/${next}/`}>الصفحة {toArabicDigits(next)}</Link> : <span />}
      </nav>
    </article>
  );
}

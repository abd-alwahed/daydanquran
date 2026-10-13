import type { Metadata } from "next";
import Link from "next/link";
import { LAUNCH_DATE, TOTAL_PAGES, todaysPage, toArabicDigits } from "@daydan/core";
import { readApprovedPages, readBuiltPages } from "@daydan/content";
import styles from "./admin.module.css";
import { CopyButton } from "./copy-button";
import { ApprovalForm, ApprovalStatus, Downloads } from "./parts";
import { readReview, whatsappText } from "./review";

export const metadata: Metadata = { title: "مراجعة الصفحات", robots: { index: false } };

/** Days ahead shown in the runway list. */
const RUNWAY_DAYS = 14;

/** Local review screen (`pnpm dev` only): today's ready-to-post page and every rendered page's status. */
export default async function AdminPage() {
  const [built, approvedList] = await Promise.all([readBuiltPages(), readApprovedPages()]);
  const approved = new Set(approvedList);
  const scheduled = todaysPage(LAUNCH_DATE, new Date());
  const today = scheduled?.page ?? 1;
  const runway = Array.from({ length: RUNWAY_DAYS }, (_, i) => ((today - 1 + i) % TOTAL_PAGES) + 1);
  const review = built.includes(today) ? await readReview(today) : null;

  return (
    <article>
      <h1>مراجعة الصفحات</h1>
      <p className={styles.note}>
        تعمل هذه الشاشة محلياً فقط ولا تُبنى مع الموقع. الاعتماد يُكتب في content/approved.json، ولا تظهر
        الصفحة على الموقع ولا تُنشر في تيليجرام حتى يُرفع هذا الملف ويُبنى الموقع من جديد.
      </p>

      <section className={styles.section}>
        <h2>
          {scheduled ? "وِرد اليوم" : "صفحة يوم الإطلاق"}: الصفحة {toArabicDigits(today)}
        </h2>
        {review ? (
          <>
            <ApprovalForm page={today} approved={review.approved} />
            <p>
              <Link href={`/admin/${today}/`}>راجع كل ملفات الصفحة</Link>
            </p>
            <h3>نص واتساب</h3>
            <textarea
              className={styles.text}
              readOnly
              value={whatsappText(review.caption)}
              aria-label="نص واتساب"
            />
            <CopyButton text={whatsappText(review.caption)} />
            <h3>الصور</h3>
            <Downloads page={today} cards={review.cards} />
          </>
        ) : (
          <p>لم تُولَّد صور هذه الصفحة بعد.</p>
        )}
      </section>

      <section className={styles.section}>
        <h2>الأيام القادمة</h2>
        <ul className={styles.pages}>
          {runway.map((page) => (
            <li key={page}>
              <Link href={`/admin/${page}/`}>
                {toArabicDigits(page)}
                {built.includes(page) ? (
                  <ApprovalStatus approved={approved.has(page)} />
                ) : (
                  <span>لم تُولَّد</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>كل الصفحات المولّدة ({toArabicDigits(built.length)})</h2>
        <ul className={styles.pages}>
          {built.map((page) => (
            <li key={page}>
              <Link href={`/admin/${page}/`}>
                {toArabicDigits(page)}
                <ApprovalStatus approved={approved.has(page)} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

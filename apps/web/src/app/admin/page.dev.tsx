import type { Metadata } from "next";
import Link from "next/link";
import { LAUNCH_DATE, TOTAL_PAGES, todaysPage, toArabicDigits } from "@daydan/core";
import { readApprovedPages, readBuiltPages, readFlaggedPages } from "@daydan/content";
import buttons from "@/components/button.module.css";
import { approveRange } from "./actions";
import styles from "./admin.module.css";
import { CopyButton } from "./copy-button";
import { ImageViewer } from "./image-viewer";
import { ApprovalForm, ApprovalStatus, Downloads } from "./parts";
import { queueUrl, readReview, whatsappText } from "./review";

export const metadata: Metadata = { title: "مراجعة الصفحات", robots: { index: false } };

/** Rendered by `pnpm --filter @daydan/media render:reminder`; also served by the deployed site. */
const REMINDER_STORY = "/reminder-story.png";

/** Days ahead shown in the runway list. */
const RUNWAY_DAYS = 14;

/** Local review screen (`pnpm dev` only): today's ready-to-post page and every rendered page's status. */
export default async function AdminPage() {
  const [built, approvedList, flagged] = await Promise.all([readBuiltPages(), readApprovedPages(), readFlaggedPages()]);
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
        <h2>المراجعة</h2>
        <p>
          المعتمد {toArabicDigits(approved.size)} من {toArabicDigits(TOTAL_PAGES)} صفحة.{" "}
          <Link className={buttons.primary} href={queueUrl()}>
            افتح طابور المراجعة
          </Link>
        </p>
        <p>
          {toArabicDigits(flagged.size)} صفحة شاذة تحتاج تدقيقاً أكثر، منها{" "}
          {toArabicDigits([...flagged.keys()].filter((p) => !approved.has(p)).length)} غير معتمدة.{" "}
          <Link href={queueUrl(0, true)}>راجعها وحدها في الطابور</Link> ·{" "}
          <a href="#flagged">القائمة</a>
        </p>
        <form action={approveRange} className={styles.range}>
          <span>اعتمد صفحات راجعتها:</span>
          <label>
            من <input name="from" type="number" min={1} max={TOTAL_PAGES} required />
          </label>
          <label>
            إلى <input name="to" type="number" min={1} max={TOTAL_PAGES} required />
          </label>
          <button type="submit" className={buttons.button}>
            اعتمد النطاق
          </button>
        </form>
      </section>

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
        <h2>ستوري تذكير المساء</h2>
        <p className={styles.note}>
          صورة واحدة لكل الأيام، تُنشر في ستوري إنستغرام وفيسبوك الساعة ٨ مساءً بتوقيت مكة.
        </p>
        <ImageViewer>
          <div className={styles.assets}>
            <figure className={styles.asset}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local review of the exact rendered file */}
              <img src={REMINDER_STORY} alt="ستوري تذكير المساء" loading="lazy" data-viewable="1" />
              <figcaption>
                ١٠٨٠×١٩٢٠ ·{" "}
                <a href={REMINDER_STORY} download="daydan-reminder-story.png">
                  تنزيل
                </a>
              </figcaption>
            </figure>
          </div>
        </ImageViewer>
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

      <section className={styles.section} id="flagged">
        <h2>الصفحات الشاذة ({toArabicDigits(flagged.size)})</h2>
        <ul className={styles.flaggedList}>
          {[...flagged].map(([page, flags]) => (
            <li key={page}>
              <Link href={`/admin/${page}/`}>
                {toArabicDigits(page)}
                <ApprovalStatus approved={approved.has(page)} />
              </Link>
              <span>{flags.join("، ")}</span>
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

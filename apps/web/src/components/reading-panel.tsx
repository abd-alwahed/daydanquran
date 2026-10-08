"use client";

import { TOTAL_PAGES, toArabicDigits } from "@daydan/core";
import { useReading } from "@/lib/reading";
import { useToday } from "@/lib/use-today";
import buttons from "./button.module.css";
import styles from "./reading-panel.module.css";

/** "قرأت" button, thanks message and personal khatma progress. No streaks, no scores. */
export function ReadingPanel({ page }: { page: number }) {
  const today = useToday();
  const { pagesRead, markRead } = useReading();
  const isTodaysPage = today?.scheduled?.page === page;
  const isRead = pagesRead.has(page);

  const label = isRead ? "قرأتها، الحمد لله" : isTodaysPage ? "قرأت وِرد اليوم" : "قرأت هذه الصفحة";

  return (
    <div className={styles.panel}>
      <button
        type="button"
        className={buttons.primary}
        disabled={isRead || !today}
        onClick={() => today && markRead(page, { localDate: today.localDate, isTodaysPage })}
      >
        {label}
      </button>
      <p className={styles.thanks} role="status">
        {isRead ? "تقبّل الله." : ""}
      </p>
      {pagesRead.size > 0 && (
        <div className={styles.progress}>
          <div
            className={styles.bar}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={TOTAL_PAGES}
            aria-valuenow={pagesRead.size}
            aria-label="تقدّم ختمتك"
          >
            <span style={{ width: `${(pagesRead.size / TOTAL_PAGES) * 100}%` }} />
          </div>
          <p>
            ختمتك: {toArabicDigits(pagesRead.size)} من {toArabicDigits(TOTAL_PAGES)} صفحة
          </p>
        </div>
      )}
    </div>
  );
}

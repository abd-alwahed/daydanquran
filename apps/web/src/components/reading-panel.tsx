"use client";

import { consecutiveDays, toArabicDigits } from "@daydan/core";
import { useReading } from "@/lib/reading";
import { useToday } from "@/lib/use-today";
import buttons from "./button.module.css";
import { KhatmaProgress } from "./khatma-progress";
import styles from "./reading-panel.module.css";

/** "قرأت" button, thanks message and personal khatma progress. No scores, nothing counted as missed. */
export function ReadingPanel({ page, juzStarts }: { page: number; juzStarts: readonly number[] }) {
  const today = useToday();
  const { pagesRead, log, markRead } = useReading();
  const isTodaysPage = today?.scheduled?.page === page;
  const isRead = pagesRead.has(page);

  const label = isRead ? "قرأتها، الحمد لله" : isTodaysPage ? "قرأت وِرد اليوم" : "قرأت هذه الصفحة";
  const days = today && isTodaysPage ? consecutiveDays(log, today.localDate) : 0;
  // Message library (docs/06-brand.md): "after reading, inside the app".
  const thanks = !isRead ? "" : days > 1 ? `تقبّل الله. هذا يومك ${toArabicDigits(days)} على التوالي.` : "تقبّل الله.";

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
        {thanks}
      </p>
      {today?.scheduled && (
        <KhatmaProgress
          pagesRead={pagesRead}
          log={log}
          localDate={today.localDate}
          todaysPage={today.scheduled.page}
          juzStarts={juzStarts}
        />
      )}
    </div>
  );
}

import { juzLabel, surahLabel, toArabicDigits, type PageData } from "@daydan/core";
import styles from "./page-heading.module.css";
import { TodayBadge } from "./today-badge";

export function PageHeading({ data }: { data: PageData }) {
  return (
    <header className={styles.heading}>
      <TodayBadge page={data.page} />
      <h1 className={styles.title}>الصفحة {toArabicDigits(data.page)}</h1>
      <p className={styles.meta}>
        سورة {surahLabel(data)} · الجزء {juzLabel(data)}
      </p>
    </header>
  );
}

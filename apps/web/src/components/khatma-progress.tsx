"use client";

import { juzOfPage, khatmaByJuz, TOTAL_PAGES, toArabicDigits, weekDays, type IsoDate } from "@daydan/core";
import styles from "./khatma-progress.module.css";

const weekday = new Intl.DateTimeFormat("ar", { weekday: "long", timeZone: "UTC" });
const weekdayShort = new Intl.DateTimeFormat("ar", { weekday: "narrow", timeZone: "UTC" });

interface Props {
  pagesRead: ReadonlySet<number>;
  log: Readonly<Record<IsoDate, number>>;
  localDate: IsoDate;
  todaysPage: number | null;
  juzStarts: readonly number[];
}

/**
 * Personal khatma as 30 juz bars and the last seven days as 7 bars.
 * Read is primary, today is gold, the rest is plain. Nothing here counts what was not read.
 */
export function KhatmaProgress({ pagesRead, log, localDate, todaysPage, juzStarts }: Props) {
  const juz = khatmaByJuz(pagesRead, juzStarts);
  const todaysJuz = todaysPage ? juzOfPage(todaysPage, juzStarts) : 0;
  const week = weekDays(log, localDate);
  const total = `ختمتك: ${toArabicDigits(pagesRead.size)} من ${toArabicDigits(TOTAL_PAGES)} صفحة`;

  return (
    <div className={styles.progress}>
      <div className={styles.juz} role="img" aria-label={total}>
        {juz.map(({ juz: n, read, total: pages }) => (
          <span key={n} className={n === todaysJuz ? styles.today : undefined}>
            <span style={{ height: `${(read / pages) * 100}%` }} />
          </span>
        ))}
      </div>
      <p className={styles.caption} aria-hidden="true">
        {total}
      </p>
      <ul className={styles.week} aria-label="هذا الأسبوع">
        {week.map(({ date, read }) => {
          const day = new Date(`${date}T00:00:00Z`);
          const isToday = date === localDate;
          return (
            <li key={date} className={read ? styles.read : isToday ? styles.today : undefined}>
              <span className={styles.day} aria-hidden="true">
                {weekdayShort.format(day)}
              </span>
              <span className="visually-hidden">
                {isToday ? "اليوم" : weekday.format(day)}
                {read ? ": قرأت" : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

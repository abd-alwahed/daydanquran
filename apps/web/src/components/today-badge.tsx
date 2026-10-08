"use client";

import { useToday } from "@/lib/use-today";
import styles from "./page-heading.module.css";

/** Gold "today" marker, shown only on today's shared page. Gold means "today" and nothing else. */
export function TodayBadge({ page }: { page: number }) {
  const today = useToday();
  if (today?.scheduled?.page !== page) return null;
  return <p className={styles.today}>وِرد اليوم</p>;
}

"use client";

import Link from "next/link";
import { pagesToMakeUp } from "@daydan/core";
import { useReading } from "@/lib/reading";
import { useToday } from "@/lib/use-today";
import styles from "./make-up-list.module.css";

/** Earlier pages not marked as read yet. An invitation, so no count and no "missed" wording. */
export function MakeUpList({ pages }: { pages: readonly { page: number; label: string }[] }) {
  const today = useToday();
  const { pagesRead } = useReading();
  if (!today) return null;

  const labels = new Map(pages.map((p) => [p.page, p.label]));
  const list = pagesToMakeUp(today.scheduled, pagesRead, labels.keys());

  if (list.length === 0) {
    return (
      <p>
        لا صفحات هنا الآن. <Link href={today.scheduled ? `/p/${today.scheduled.page}/` : "/"}>صفحة اليوم بانتظارك.</Link>
      </p>
    );
  }
  return (
    <ul className={styles.list}>
      {list.map((page) => (
        <li key={page}>
          <Link href={`/p/${page}/`}>{labels.get(page)}</Link>
        </li>
      ))}
    </ul>
  );
}

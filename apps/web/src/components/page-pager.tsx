import Link from "next/link";
import { TOTAL_PAGES, toArabicDigits } from "@daydan/core";
import styles from "./page-pager.module.css";

/** Links only to pages that exist on the site (approved pages). */
export function PagePager({ page, available }: { page: number; available: ReadonlySet<number> }) {
  const next = page < TOTAL_PAGES && available.has(page + 1) ? page + 1 : null;
  const previous = page > 1 && available.has(page - 1) ? page - 1 : null;
  return (
    <nav className={styles.pager} aria-label="التنقل بين الصفحات">
      {previous ? <Link href={`/p/${previous}/`}>الصفحة {toArabicDigits(previous)}</Link> : <span />}
      {next ? <Link href={`/p/${next}/`}>الصفحة {toArabicDigits(next)}</Link> : <span />}
    </nav>
  );
}

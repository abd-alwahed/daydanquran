import { SOURCES } from "@/lib/sources";
import styles from "./site-footer.module.css";

export function SiteFooter() {
  return (
    <footer className={`container ${styles.footer}`}>
      <p>
        {SOURCES.map((source, i) => (
          <span key={source.label}>
            {i > 0 && " · "}
            {source.label}: {"href" in source ? <a href={source.href}>{source.value}</a> : source.value}
          </span>
        ))}
        {" · "}دَيْدَن مشروع غير ربحي.
      </p>
    </footer>
  );
}

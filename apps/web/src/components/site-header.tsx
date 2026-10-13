import Link from "next/link";
import { BrandMark } from "./brand-mark";
import styles from "./site-header.module.css";

export function SiteHeader() {
  return (
    <header className={`container ${styles.header}`}>
      <Link href="/" className={styles.brand}>
        <BrandMark />
        <span>دَيْدَن</span>
      </Link>
      <nav className={styles.nav} aria-label="القائمة">
        <Link href="/qada/">اقضِ ما فاتك</Link>
        <Link href="/about/">عن دَيْدَن</Link>
      </nav>
    </header>
  );
}

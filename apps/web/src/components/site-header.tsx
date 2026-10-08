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
      <Link href="/about/" className={styles.link}>
        عن دَيْدَن
      </Link>
    </header>
  );
}

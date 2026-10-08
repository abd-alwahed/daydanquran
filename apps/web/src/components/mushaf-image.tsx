import { toArabicDigits } from "@daydan/core";
import styles from "./mushaf-image.module.css";

const WIDTH = 1260;
const HEIGHT = 2038;

/** The official page image, shown exactly as published: no overlay, crop or recolor. */
export function MushafImage({ page }: { page: number }) {
  return (
    <figure className={styles.frame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static export serves the file as-is */}
      <img
        src={`/p/${page}/mushaf.png`}
        width={WIDTH}
        height={HEIGHT}
        alt={`الصفحة ${toArabicDigits(page)} من مصحف المدينة`}
        className={styles.image}
        fetchPriority="high"
      />
    </figure>
  );
}

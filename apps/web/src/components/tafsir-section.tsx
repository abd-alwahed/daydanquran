import { tafsirUnits, type PageData } from "@daydan/core";
import styles from "./tafsir-section.module.css";

/** Tafsir Muyassar for the page, verbatim. Our own wording (pointers) is styled apart from it. */
export function TafsirSection({ data }: { data: PageData }) {
  const names = new Map(data.surahs.map((s) => [s.id, s.name]));
  const showSurahNames = data.surahs.length > 1;
  const units = tafsirUnits(data);

  return (
    <section className={styles.section} aria-labelledby="tafsir-title">
      <h2 id="tafsir-title">التفسير الميسر</h2>
      {units.map((unit, i) => (
        <div key={`${unit.surah}:${unit.from}`}>
          {showSurahNames && unit.surah !== units[i - 1]?.surah && <h3>سورة {names.get(unit.surah)}</h3>}
          <p className={unit.isPointer ? styles.pointer : styles.paragraph}>
            <span className={styles.number}>({unit.label})</span> {unit.text}
          </p>
        </div>
      ))}
    </section>
  );
}

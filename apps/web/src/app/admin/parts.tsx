import { toArabicDigits, type PageCards } from "@daydan/core";
import buttons from "@/components/button.module.css";
import { setApproval } from "./actions";
import styles from "./admin.module.css";
import { fileUrl } from "./review";

/** One generated image at its own aspect ratio, never cropped. */
export function Asset({
  page,
  file,
  label,
  mushaf = false,
}: {
  page: number;
  file: string;
  label: string;
  mushaf?: boolean;
}) {
  return (
    <figure className={mushaf ? styles.mushaf : styles.asset}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local review of the exact rendered file */}
      <img src={fileUrl(page, file)} alt={label} loading="lazy" />
      <figcaption>
        {label} ·{" "}
        <a href={fileUrl(page, file)} download={`daydan-p${page}-${file}`}>
          تنزيل
        </a>
      </figcaption>
    </figure>
  );
}

/** Download links for the images that are posted by hand (WhatsApp, Instagram, Facebook). */
export function Downloads({ page, cards }: { page: number; cards: PageCards }) {
  const files = [
    { file: cards.post, label: "المنشور" },
    { file: cards.story, label: "الستوري" },
    ...cards.tafsir.map((file, i) => ({ file, label: `بطاقة التفسير ${toArabicDigits(i + 1)}` })),
  ];
  return (
    <ul className={styles.downloads}>
      {files.map(({ file, label }) => (
        <li key={file}>
          <a className={buttons.button} href={fileUrl(page, file)} download={`daydan-p${page}-${file}`}>
            تنزيل {label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ApprovalStatus({ approved }: { approved: boolean }) {
  return (
    <span className={approved ? styles.approved : styles.pending}>
      {approved ? "معتمدة" : "بانتظار المراجعة"}
    </span>
  );
}

export function ApprovalForm({ page, approved }: { page: number; approved: boolean }) {
  return (
    <form action={setApproval.bind(null, page, !approved)} className={styles.approval}>
      <ApprovalStatus approved={approved} />
      <button type="submit" className={approved ? buttons.button : buttons.primary}>
        {approved ? "سحب الاعتماد" : "اعتماد الصفحة"}
      </button>
    </form>
  );
}

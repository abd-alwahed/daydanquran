import type { Metadata } from "next";
import { NAME_MEANING, SOURCES } from "@/lib/sources";

export const metadata: Metadata = { title: "عن دَيْدَن", description: NAME_MEANING };

export default function AboutPage() {
  return (
    <section>
      <h1>عن دَيْدَن</h1>
      <p>{NAME_MEANING}</p>
      <p>
        كل يوم صفحة واحدة من مصحف المدينة، يقرؤها الجميع في اليوم نفسه، مع التفسير الميسر وتلاوة الشيخ محمود خليل
        الحصري. بعد الصفحة ٦٠٤ نبدأ معاً ختمة جديدة.
      </p>
      <h2>المصادر</h2>
      <ul>
        {SOURCES.map((source) => (
          <li key={source.label}>
            {source.label}: {"href" in source ? <a href={source.href}>{source.value}</a> : source.value}
          </li>
        ))}
      </ul>
      <p>صور صفحات المصحف تُعرض كما هي دون أي تعديل، ونص التفسير منقول حرفياً من مصدره. دَيْدَن مشروع غير ربحي.</p>
    </section>
  );
}

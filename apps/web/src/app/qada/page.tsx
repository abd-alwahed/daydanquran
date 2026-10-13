import type { Metadata } from "next";
import { surahLabel, toArabicDigits } from "@daydan/core";
import { readPage } from "@daydan/content";
import { MakeUpList } from "@/components/make-up-list";
import { readPublishedPages } from "@/lib/published-pages";

export const metadata: Metadata = { title: "اقضِ ما فاتك" };

export default async function MakeUpPage() {
  const pages = await Promise.all(
    (await readPublishedPages()).map(async (page) => {
      const data = await readPage(page);
      return { page, label: `الصفحة ${toArabicDigits(page)} · سورة ${surahLabel(data)}` };
    }),
  );

  return (
    <section>
      <h1>اقضِ ما فاتك</h1>
      <p>صفحات مرّت قبل اليوم، اقرأ منها ما تيسّر متى شئت، وكل صفحة تقرؤها تُضاف إلى ختمتك.</p>
      <MakeUpList pages={pages} />
    </section>
  );
}

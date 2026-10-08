import type { Metadata } from "next";
import { SITE_URL, surahLabel, toArabicDigits } from "@daydan/core";
import { readPage } from "@daydan/content";
import actions from "@/components/actions.module.css";
import { MushafImage } from "@/components/mushaf-image";
import { PageHeading } from "@/components/page-heading";
import { PagePager } from "@/components/page-pager";
import { ReadingPanel } from "@/components/reading-panel";
import { RecitationPlayer } from "@/components/recitation-player";
import { TafsirSection } from "@/components/tafsir-section";
import { readPublishedPages } from "@/lib/published-pages";

interface Props {
  params: Promise<{ page: string }>;
}

/** Only published (approved) pages are built. Anything else is a 404. */
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await readPublishedPages()).map((page) => ({ page: String(page) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await readPage(Number((await params).page));
  const title = `الصفحة ${toArabicDigits(data.page)} · سورة ${surahLabel(data)}`;
  const description = `وِرد اليوم من القرآن الكريم: الصفحة ${toArabicDigits(data.page)} من سورة ${surahLabel(data)}، مع التفسير الميسر وتلاوة الحصري.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/p/${data.page}/` },
    openGraph: { title, description, images: [`/p/${data.page}/post.png`] },
  };
}

export default async function MushafPage({ params }: Props) {
  const data = await readPage(Number((await params).page));
  const available = new Set(await readPublishedPages());

  return (
    <article>
      <PageHeading data={data} />
      <MushafImage page={data.page} />
      <div className={actions.actions}>
        <RecitationPlayer tracks={data.ayahs.map((a) => a.audio)} />
        <ReadingPanel page={data.page} />
      </div>
      <p className={actions.reciter}>التلاوة: الشيخ محمود خليل الحصري (مرتّل)</p>
      <TafsirSection data={data} />
      <PagePager page={data.page} available={available} />
    </article>
  );
}

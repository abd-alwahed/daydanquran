import type { AyahKey } from "@daydan/core";
import { cachedFetch, cachedJson } from "../http-cache";
import { stripHtml } from "../text";

const API = "https://api.quran.com/api/v4";
const AUDIO_CDN = "https://verses.quran.com/";
const MUSHAF_URL = (page: number) =>
  `https://files.quran.app/hafs/madani/width_1260/page${String(page).padStart(3, "0")}.png`;
const PER_PAGE = 50;

interface Pagination {
  next_page: number | null;
}

interface ApiVerse {
  verse_key: AyahKey;
  verse_number: number;
  chapter_id: number;
  juz_number: number;
  text_uthmani: string;
  audio?: { url?: string };
}

interface ApiTafsir {
  verse_key: AyahKey;
  text: string;
}

export interface SourceVerse {
  key: AyahKey;
  surah: number;
  ayah: number;
  juz: number;
  /** Quran.com's Uthmani text, used only to cross-check against Tanzil. */
  textForCheck: string;
  audio: string | null;
}

export interface TafsirGroup {
  /** Ayahs Tafsir Muyassar explains in this one passage, in Mushaf order. */
  covers: AyahKey[];
  text: string;
}

export interface SourceIds {
  recitationId: number;
  tafsirId: number;
}

function assertSinglePage(pagination: Pagination | undefined, what: string): void {
  if (pagination?.next_page) throw new Error(`${what}: more than ${PER_PAGE} results, pagination not handled`);
}

/** Quran.com API v4: page layout, Tafsir Muyassar, Husary audio links. Every response is cached. */
export class QuranComSource {
  private constructor(readonly ids: SourceIds) {}

  /**
   * Resolves the Husary (murattal) recitation and Tafsir Muyassar by name, never by a hard-coded id,
   * and fails if the match is not unique.
   */
  static async create(): Promise<QuranComSource> {
    const { recitations } = await cachedJson<{ recitations: { id: number; reciter_name: string; style: string | null }[] }>(
      "recitations.json",
      `${API}/resources/recitations?language=ar`,
    );
    const husary = recitations.filter((r) => /husary/i.test(r.reciter_name) && !/muallim|mujawwad/i.test(r.style ?? ""));

    const { tafsirs } = await cachedJson<{ tafsirs: { id: number; name: string; slug: string; language_name: string }[] }>(
      "tafsirs.json",
      `${API}/resources/tafsirs`,
    );
    const muyassar = tafsirs.filter((t) => t.language_name === "arabic" && /muyassar/i.test(`${t.name} ${t.slug}`));

    if (husary.length !== 1 || muyassar.length !== 1) {
      throw new Error(`Ambiguous source ids: husary=${JSON.stringify(husary)} muyassar=${JSON.stringify(muyassar)}`);
    }
    return new QuranComSource({ recitationId: husary[0]!.id, tafsirId: muyassar[0]!.id });
  }

  async chapterNames(): Promise<Map<number, string>> {
    const { chapters } = await cachedJson<{ chapters: { id: number; name_arabic: string }[] }>(
      "chapters.json",
      `${API}/chapters?language=ar`,
    );
    return new Map(chapters.map((c) => [c.id, c.name_arabic]));
  }

  async versesOnPage(page: number): Promise<SourceVerse[]> {
    const { verses, pagination } = await cachedJson<{ verses: ApiVerse[]; pagination: Pagination }>(
      `verses/${page}.json`,
      `${API}/verses/by_page/${page}?language=ar&words=false&per_page=${PER_PAGE}&fields=text_uthmani,chapter_id,juz_number&audio=${this.ids.recitationId}`,
    );
    assertSinglePage(pagination, `verses on page ${page}`);
    return verses.map((v) => ({
      key: v.verse_key,
      surah: v.chapter_id,
      ayah: v.verse_number,
      juz: v.juz_number,
      textForCheck: v.text_uthmani,
      audio: v.audio?.url ? new URL(v.audio.url, AUDIO_CDN).href : null,
    }));
  }

  /** Tafsir text per ayah on a page. In a group, only the first ayah has text here. */
  async tafsirOnPage(page: number): Promise<Map<AyahKey, string>> {
    const { tafsirs, pagination } = await cachedJson<{ tafsirs: ApiTafsir[]; pagination?: Pagination }>(
      `tafsir/${page}.json`,
      `${API}/tafsirs/${this.ids.tafsirId}/by_page/${page}?per_page=${PER_PAGE}`,
    );
    assertSinglePage(pagination, `tafsir on page ${page}`);
    return new Map(tafsirs.map((t) => [t.verse_key, stripHtml(t.text)]));
  }

  /** The tafsir passage that explains `key`, with the ayahs the API says it covers. */
  async tafsirForAyah(key: AyahKey): Promise<TafsirGroup> {
    const { tafsir } = await cachedJson<{ tafsir: { text: string; verses: Record<AyahKey, unknown> } }>(
      `tafsir-ayah/${key.replace(":", "_")}.json`,
      `${API}/tafsirs/${this.ids.tafsirId}/by_ayah/${key}`,
    );
    return { covers: Object.keys(tafsir.verses) as AyahKey[], text: stripHtml(tafsir.text) };
  }

  mushafImage(page: number): Promise<Buffer> {
    return cachedFetch(`mushaf/${page}.png`, MUSHAF_URL(page));
  }
}

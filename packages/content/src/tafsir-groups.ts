import type { AyahKey } from "@daydan/core";
import type { TafsirGroup } from "./sources/quran-com";

const parse = (key: AyahKey) => key.split(":").map(Number) as [number, number];

/**
 * Tracks which ayahs Tafsir Muyassar explains together.
 *
 * The API's group metadata stops at 10 ayahs (e.g. at-Takwir 1–14 is listed as 1–10).
 * An ayah is added to a group only when the API returns, for that ayah, the very same passage
 * starting earlier in the same surah. Nothing is inferred from position alone.
 */
export class TafsirGroups {
  private readonly byKey = new Map<AyahKey, TafsirGroup>();

  constructor(private readonly lookup: (key: AyahKey) => Promise<TafsirGroup>) {}

  get(key: AyahKey): TafsirGroup | undefined {
    return this.byKey.get(key);
  }

  get size(): number {
    return new Set(this.byKey.values()).size;
  }

  async resolve(key: AyahKey): Promise<TafsirGroup> {
    const known = this.byKey.get(key);
    if (known) return known;

    const fetched = await this.lookup(key);
    const group = this.byKey.get(fetched.covers[0]!) ?? { covers: [...fetched.covers], text: fetched.text };
    if (group.text !== fetched.text) throw new Error(`${key}: the API returned two different passages for one group`);

    const [surah, ayah] = parse(key);
    const [startSurah, startAyah] = parse(group.covers[0]!);
    if (!group.covers.includes(key) && surah === startSurah && ayah > startAyah) group.covers.push(key);

    for (const k of group.covers) this.byKey.set(k, group);
    return group;
  }
}

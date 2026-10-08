import type { PageCards } from "@daydan/core";
import type { InputMediaPhoto } from "./telegram";

/** Telegram's limit for one media group. */
export const MAX_ALBUM_SIZE = 10;

async function fetchOk(url: string, fetchImpl: typeof fetch): Promise<Response> {
  const response = await fetchImpl(url);
  // A missing file means the page is not approved (not on the site). Never publish around that.
  if (!response.ok) throw new Error(`${response.status} ${url}: الصفحة غير معتمدة أو غير منشورة على الموقع`);
  return response;
}

/** Mushaf page first (with the caption), then the tafsir cards, all served by the site. */
export async function buildAlbum(siteUrl: string, page: number, fetchImpl: typeof fetch = fetch): Promise<InputMediaPhoto[]> {
  const base = `${siteUrl}/p/${page}`;
  const cards = (await (await fetchOk(`${base}/cards.json`, fetchImpl)).json()) as PageCards;
  const caption = await (await fetchOk(`${base}/caption.txt`, fetchImpl)).text();
  const files = [cards.mushaf, ...cards.tafsir];
  if (files.length > MAX_ALBUM_SIZE) throw new Error(`الصفحة ${page}: ${files.length} صور، والحد ${MAX_ALBUM_SIZE}`);
  return files.map((file, i) => ({ type: "photo", media: `${base}/${file}`, ...(i === 0 ? { caption } : {}) }));
}

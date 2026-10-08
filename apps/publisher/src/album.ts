import type { PageCards } from "@daydan/core";
import type { InputMediaPhoto } from "./telegram";

/** Telegram's limit for one media group. A longer page is posted as consecutive albums. */
export const MAX_ALBUM_SIZE = 10;

async function fetchOk(url: string, fetchImpl: typeof fetch): Promise<Response> {
  const response = await fetchImpl(url);
  // A missing file means the page is not approved (not on the site). Never publish around that.
  if (!response.ok) throw new Error(`${response.status} ${url}: الصفحة غير معتمدة أو غير منشورة على الموقع`);
  return response;
}

/**
 * The day's post as one or more albums: the Mushaf page first (carrying the caption),
 * then the tafsir cards in order, all served by the site.
 */
export async function buildAlbums(
  siteUrl: string,
  page: number,
  fetchImpl: typeof fetch = fetch,
): Promise<InputMediaPhoto[][]> {
  const base = `${siteUrl}/p/${page}`;
  const cards = (await (await fetchOk(`${base}/cards.json`, fetchImpl)).json()) as PageCards;
  const caption = await (await fetchOk(`${base}/caption.txt`, fetchImpl)).text();

  const photos: InputMediaPhoto[] = [cards.mushaf, ...cards.tafsir].map((file, i) => ({
    type: "photo",
    media: `${base}/${file}`,
    ...(i === 0 ? { caption } : {}),
  }));
  const albums: InputMediaPhoto[][] = [];
  for (let i = 0; i < photos.length; i += MAX_ALBUM_SIZE) albums.push(photos.slice(i, i + MAX_ALBUM_SIZE));
  return albums;
}

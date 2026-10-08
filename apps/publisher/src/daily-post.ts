import type { PageCards } from "@daydan/core";
import { readButton } from "./read-button";
import type { InlineButton, InputMediaPhoto } from "./telegram";

/** Telegram's limit for one media group. */
export const MAX_ALBUM_SIZE = 10;

/** One Telegram message of the day's post. */
export type PostPart =
  | { kind: "photo"; photo: string; caption?: string; buttons?: InlineButton[][] }
  | { kind: "album"; media: InputMediaPhoto[] };

async function fetchOk(url: string, fetchImpl: typeof fetch): Promise<Response> {
  const response = await fetchImpl(url);
  // A missing file means the page is not approved (not on the site). Never publish around that.
  if (!response.ok) throw new Error(`${response.status} ${url}: الصفحة غير معتمدة أو غير منشورة على الموقع`);
  return response;
}

/**
 * The day's post, in order:
 * 1. the designed page on its own (full width, which an album cannot guarantee) with the caption
 *    and the "قرأت الورد" button (Telegram allows buttons on single messages only);
 * 2. the tafsir cards as albums of up to ten.
 * Everything is served by the site, so only approved pages can be posted.
 */
export async function buildDailyPost(siteUrl: string, page: number, fetchImpl: typeof fetch = fetch): Promise<PostPart[]> {
  const base = `${siteUrl}/p/${page}`;
  const cards = (await (await fetchOk(`${base}/cards.json`, fetchImpl)).json()) as PageCards;
  const caption = await (await fetchOk(`${base}/caption.txt`, fetchImpl)).text();

  const parts: PostPart[] = [{ kind: "photo", photo: `${base}/${cards.post}`, caption, buttons: [[readButton(page)]] }];
  for (let i = 0; i < cards.tafsir.length; i += MAX_ALBUM_SIZE) {
    const chunk = cards.tafsir.slice(i, i + MAX_ALBUM_SIZE).map((file) => `${base}/${file}`);
    // A media group needs at least two photos.
    parts.push(
      chunk.length === 1
        ? { kind: "photo", photo: chunk[0]! }
        : { kind: "album", media: chunk.map((media) => ({ type: "photo", media })) },
    );
  }
  return parts;
}

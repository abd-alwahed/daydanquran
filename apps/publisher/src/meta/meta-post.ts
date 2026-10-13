import { SITE_URL, type PageCards } from "@daydan/core";
import { imageSize, sameAspect, splitIntoCarousels } from "@daydan/publishers";
import { fetchOk } from "../daily-post";

/** The evening reminder story: one image for every day (packages/media render:reminder), as JPEG. */
export const STORY_URL = `${SITE_URL}/reminder-story.jpg`;
const STORY_ASPECT = { width: 9, height: 16 };

/** Mecca weekdays with a reel (0 = Sunday): Friday, Monday, Wednesday. */
export const REEL_WEEKDAYS: readonly number[] = [5, 1, 3];
export const isReelDay = (date: string) => REEL_WEEKDAYS.includes(new Date(`${date}T00:00:00Z`).getUTCDay());

/**
 * Instagram's copy of a page file (packages/media `instagramFile`): JPEG, the only image format its
 * publishing API accepts, and 4:5 like the designed page, because Instagram crops every carousel item
 * to the first one's shape, which would cut tafsir text off the square cards.
 */
export const instagramFile = (file: string) => `ig-${file.replace(/\.png$/, ".jpg")}`;

/** The day's Meta post: all files are the site's own, so only approved pages can be posted. */
export interface MetaPost {
  page: number;
  caption: string;
  /** Instagram copies of the designed page + tafsir cards, all JPEG and 4:5, split to respect the carousel limit. */
  instagram: string[][];
  /** Designed page + the original tafsir cards (Facebook shows photos uncropped). */
  facebook: string[];
}

export async function buildMetaPost(page: number, fetchImpl: typeof fetch = fetch): Promise<MetaPost> {
  const base = `${SITE_URL}/p/${page}`;
  const cards = (await (await fetchOk(`${base}/cards.json`, fetchImpl)).json()) as PageCards;
  const caption = await pageCaption(page, fetchImpl);

  return {
    page,
    caption,
    instagram: splitIntoCarousels([cards.post, ...cards.tafsir].map((f) => `${base}/${instagramFile(f)}`)),
    facebook: [cards.post, ...cards.tafsir].map((f) => `${base}/${f}`),
  };
}

export async function pageCaption(page: number, fetchImpl: typeof fetch = fetch): Promise<string> {
  return (await fetchOk(`${SITE_URL}/p/${page}/caption.txt`, fetchImpl)).text();
}

/** Refuses what Instagram would reject (not JPEG) or crop (another shape): cropping would cut the Mushaf page or tafsir text. */
export async function assertInstagramReady(post: MetaPost, fetchImpl: typeof fetch = fetch): Promise<void> {
  const urls = post.instagram.flat();
  const sizes = await Promise.all(urls.map((url) => imageSize(url, fetchImpl)));
  const odd = urls.filter((_, i) => sizes[i]!.format !== "jpeg" || !sameAspect(sizes[i]!, sizes[0]!));
  if (odd.length) throw new Error(`صور ليست JPEG أو بغير مقاس الصورة الأولى (سيقصّها إنستغرام): ${odd.join(" ")}`);
}

export async function assertStoryShape(fetchImpl: typeof fetch = fetch): Promise<void> {
  const size = await imageSize(STORY_URL, fetchImpl);
  if (size.format !== "jpeg" || !sameAspect(size, STORY_ASPECT)) throw new Error(`${STORY_URL}: ليست JPEG بمقاس ٩:١٦`);
}

/** A page video on the site (`video.mp4`: the whole page; `reel.mp4`: ≤90 s, 9:16), or null if not made yet. */
export async function pageVideo(page: number, file: "video.mp4" | "reel.mp4", fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const url = `${SITE_URL}/p/${page}/${file}`;
  return (await fetchImpl(url, { method: "HEAD" })).ok ? url : null;
}

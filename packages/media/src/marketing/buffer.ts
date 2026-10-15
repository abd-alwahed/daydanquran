import { canvasSize } from "./assets";
import { entryFiles, type DayFile } from "./folders";
import { QUOTES_TO_REVIEW, type Entry } from "./plan";

/** Buffer's free plan holds at most 10 scheduled posts per channel at a time. */
export const SCHEDULED_MAX = 10;

/** A plan post for Buffer: its caption, image URLs (in order) and Mecca time as a UTC instant. */
export interface BufferPost {
  date: string;
  title: string;
  text: string;
  images: string[];
  dueAt: string;
  /** Quotes wait for the content reviewer, so they only ever go in as drafts. */
  needsReview: boolean;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const latinDigits = (text: string) => text.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));

/** "2026-10-17" at "٢٠:٣٠" Mecca time (UTC+3, no daylight saving) → "2026-10-17T17:30:00.000Z". */
export function meccaToUtc(date: string, time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(latinDigits(time));
  if (!match) throw new Error(`${date}: time "${time}" is not HH:MM`);
  return new Date(`${date}T${match[1]}:${match[2]}:00+03:00`).toISOString();
}

/** Stories posted the same day (1080×1920: countdowns, Friday, launch, reminder) are not part of the post. */
const isStory = (f: DayFile) =>
  "asset" in f ? canvasSize(f.asset.html).height === 1920 : f.name.includes("story");

/** The plan's feed posts (stories stay manual), with their images on the public `mediaBase`. */
export const bufferPosts = (plan: Entry[], mediaBase: string): BufferPost[] =>
  plan
    .filter((e) => e.kind === "منشور" && e.caption)
    .map((e) => ({
      date: e.date,
      title: e.title,
      text: e.caption!,
      images: entryFiles(e)
        .filter((f) => !isStory(f))
        .map((f) => `${mediaBase}/${e.date}/${f.name}`),
      dueAt: meccaToUtc(e.date, e.time),
      needsReview: QUOTES_TO_REVIEW.includes(e.date),
    }));

/** Captions compare equal regardless of spacing differences Buffer or a paste may introduce. */
export const sameText = (a: string, b: string): boolean =>
  a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

/** A post already in Buffer. `dueAt` is set on scheduled posts and on drafts given a date. */
export interface ExistingPost {
  text: string;
  status: string;
  dueAt?: string | null;
}

/** The Mecca date (UTC+3) of a UTC instant. */
export const meccaDate = (instant: string): string =>
  new Date(new Date(instant).getTime() + 3 * 3600_000).toISOString().slice(0, 10);

/**
 * Whether Buffer already has this post: same caption, and the same Mecca date when Buffer has one,
 * since the Friday posts share a caption and differ only by date.
 */
export const alreadyIn = (post: BufferPost, existing: ExistingPost[]): boolean =>
  existing.some((p) => sameText(p.text, post.text) && (!p.dueAt || meccaDate(p.dueAt) === post.date));

export type Action = "skip-exists" | "skip-past" | "schedule" | "draft";

/**
 * What to do with each post on one channel: skip what Buffer already has (scheduled or draft, matched
 * by caption and date) or what is already past, schedule while the channel has room, and save the rest as drafts.
 */
export function planActions(
  posts: BufferPost[],
  existing: ExistingPost[],
  now: Date,
): { post: BufferPost; action: Action }[] {
  let scheduled = existing.filter((p) => p.status === "scheduled").length;
  return posts.map((post) => {
    if (alreadyIn(post, existing)) return { post, action: "skip-exists" };
    if (new Date(post.dueAt) <= now) return { post, action: "skip-past" };
    if (!post.needsReview && scheduled < SCHEDULED_MAX) {
      scheduled++;
      return { post, action: "schedule" };
    }
    return { post, action: "draft" };
  });
}

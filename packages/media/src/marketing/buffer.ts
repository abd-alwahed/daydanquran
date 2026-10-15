import { canvasSize } from "./assets";
import { entryFiles, type DayFile } from "./folders";
import type { Entry } from "./plan";

/** Buffer's free plan holds at most 10 scheduled posts per channel at a time. */
export const SCHEDULED_MAX = 10;

/** A plan item for Buffer: a feed post (caption + images) or a story (one image, no text). */
export interface BufferPost {
  date: string;
  title: string;
  type: "post" | "story";
  text: string;
  images: string[];
  /** Mecca time as a UTC instant. */
  dueAt: string;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const latinDigits = (text: string) => text.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));

/** "2026-10-17" at "٢٠:٣٠" Mecca time (UTC+3, no daylight saving) → "2026-10-17T17:30:00.000Z". */
export function meccaToUtc(date: string, time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(latinDigits(time));
  if (!match) throw new Error(`${date}: time "${time}" is not HH:MM`);
  return new Date(`${date}T${match[1]}:${match[2]}:00+03:00`).toISOString();
}

/** Stories are 1080×1920: countdowns, Friday, launch, reminder. */
const isStory = (f: DayFile) =>
  "asset" in f ? canvasSize(f.asset.html).height === 1920 : f.name.includes("story");

/** Stories with a fixed time of their own; any other story goes out at its entry's time. */
const STORY_TIMES: Record<string, string> = {
  "friday-story.png": "١٢:٠٠",
  "reminder-story.png": "٢٠:٠٠",
};

/** The plan's feed posts and stories, in date order, with their images on the public `mediaBase`. */
export function bufferPosts(plan: Entry[], mediaBase: string): BufferPost[] {
  const url = (e: Entry, f: DayFile) => `${mediaBase}/${e.date}/${f.name}`;
  return plan.flatMap((e) => {
    const files = entryFiles(e);
    const post: BufferPost[] =
      e.kind === "منشور" && e.caption
        ? [
            {
              date: e.date,
              title: e.title,
              type: "post",
              text: e.caption,
              images: files.filter((f) => !isStory(f)).map((f) => url(e, f)),
              dueAt: meccaToUtc(e.date, e.time),
            },
          ]
        : [];
    const stories: BufferPost[] = files.filter(isStory).map((f) => ({
      date: e.date,
      title: `ستوري: ${f.name}`,
      type: "story",
      text: "",
      images: [url(e, f)],
      dueAt: meccaToUtc(e.date, STORY_TIMES[f.name] ?? e.time),
    }));
    return [...post, ...stories];
  });
}

/** Captions compare equal regardless of spacing differences Buffer or a paste may introduce. */
export const sameText = (a: string, b: string): boolean =>
  a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

/** A post already in Buffer. `dueAt` is set on scheduled posts and on drafts given a date. */
export interface ExistingPost {
  text: string;
  status: string;
  type?: string | null;
  dueAt?: string | null;
}

/** The Mecca date (UTC+3) of a UTC instant. */
export const meccaDate = (instant: string): string =>
  new Date(new Date(instant).getTime() + 3 * 3600_000).toISOString().slice(0, 10);

const sameDate = (p: ExistingPost, date: string) => !p.dueAt || meccaDate(p.dueAt) === date;

export type Action = "skip-exists" | "skip-past" | "schedule" | "draft";

/**
 * What to do with each item on one channel: skip what Buffer already has, or what is already past,
 * schedule while the channel has room, and save the rest as drafts. A post is matched by caption and
 * date (the Friday posts share a caption). A story has no text, so a date's first N planned stories
 * count as present when Buffer already has N stories on that date.
 */
export function planActions(
  posts: BufferPost[],
  existing: ExistingPost[],
  now: Date,
): { post: BufferPost; action: Action }[] {
  let scheduled = existing.filter((p) => p.status === "scheduled").length;
  const storiesSeen = new Map<string, number>();
  return posts.map((post) => {
    let exists: boolean;
    if (post.type === "story") {
      const index = storiesSeen.get(post.date) ?? 0;
      storiesSeen.set(post.date, index + 1);
      exists = index < existing.filter((p) => p.type === "story" && sameDate(p, post.date)).length;
    } else {
      exists = existing.some(
        (p) => p.type !== "story" && sameText(p.text, post.text) && sameDate(p, post.date),
      );
    }
    if (exists) return { post, action: "skip-exists" };
    if (new Date(post.dueAt) <= now) return { post, action: "skip-past" };
    if (scheduled < SCHEDULED_MAX) {
      scheduled++;
      return { post, action: "schedule" };
    }
    return { post, action: "draft" };
  });
}

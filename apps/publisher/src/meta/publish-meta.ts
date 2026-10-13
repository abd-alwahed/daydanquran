import type { IsoDate } from "@daydan/core";
import {
  ContainerNotReadyError,
  IMAGE_POLL,
  VIDEO_POLL,
  postOnce,
  publishOnce,
  retry,
  type Facebook,
  type Instagram,
  type Ledger,
} from "@daydan/publishers";
import { publishGate } from "../publish-gate";
import { STORY_URL, assertInstagramReady, assertStoryShape, buildMetaPost, isReelDay, pageCaption, pageVideo, type MetaPost } from "./meta-post";

export interface MetaConfig {
  instagramEnabled: boolean;
  facebookEnabled: boolean;
  /** Reels and the Facebook page video. Off until the recitation may be re-published (docs/09 #2). */
  videoEnabled: boolean;
  /** Builds and checks everything, reports it to the admin, and calls no Meta API. */
  dryRun: boolean;
}

export interface MetaDeps {
  /** Missing when its token or account id is not configured. */
  instagram?: Instagram;
  facebook?: Facebook;
  /** One key per (channel, Mecca date), shared with Telegram's KV namespace. */
  ledger: Ledger;
  config: MetaConfig;
  /** A message to the admin chat (dry-run reports). */
  report: (text: string) => Promise<unknown>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export type MetaChannel = "instagram" | "facebook" | "instagram-story" | "instagram-reel" | "facebook-video";

export interface ChannelResult {
  channel: MetaChannel;
  status: "published" | "already" | "dry-run" | "skipped" | "pending" | "over-quota" | "failed";
  detail?: string;
}

/** Results the admin must hear about. */
export const needsAttention = (r: ChannelResult) => r.status === "failed" || r.status === "over-quota" || r.status === "pending";

const dayKey = (channel: MetaChannel, date: IsoDate) => `published:${channel}:${date}`;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Runs one channel; its failure is reported and never stops the other channels. */
async function run(channel: MetaChannel, job: () => Promise<Omit<ChannelResult, "channel">>): Promise<ChannelResult> {
  try {
    return { channel, ...(await job()) };
  } catch (error) {
    if (error instanceof ContainerNotReadyError) return { channel, status: "pending", detail: `${message(error)}، يُستأنف الساعة ٢٠:٠٠ مكة` };
    return { channel, status: "failed", detail: message(error) };
  }
}

const off = (detail: string) => ({ status: "skipped" as const, detail });

/** Publishing would exceed the account's limit, read from Meta just now. */
async function overQuota(ig: Instagram, posts: number): Promise<string | null> {
  const remaining = await ig.remainingQuota();
  return remaining < posts ? `بقي ${remaining} من حد النشر، والمطلوب ${posts}` : null;
}

function configured<T>(client: T | undefined, what: string): T {
  if (!client) throw new Error(`${what} غير مضبوط (META_ACCESS_TOKEN أو رقم الحساب)`);
  return client;
}

async function instagramCarousels(deps: MetaDeps, date: IsoDate, post: MetaPost) {
  const { ledger, sleep } = deps;
  const key = dayKey("instagram", date);
  if (await ledger.get(key)) return { status: "already" as const };
  await assertInstagramReady(post, deps.fetchImpl);
  if (deps.config.dryRun) {
    await deps.report(`🧪 إنستغرام (تجربة): الصفحة ${post.page}، ${post.instagram.length} ألبوم: ${post.instagram.map((c) => c.length).join(" + ")} صور`);
    return { status: "dry-run" as const };
  }
  const ig = configured(deps.instagram, "إنستغرام");

  const parts = post.instagram.map((items, i) => ({ items, key: `${key}:carousel:${i}` }));
  const todo = [];
  for (const part of parts) if (!(await ledger.get(part.key))) todo.push(part);
  const quota = await overQuota(ig, todo.length);
  if (quota) return { status: "over-quota" as const, detail: quota };

  for (const part of todo) {
    await publishOnce(ig, ledger, part.key, IMAGE_POLL, async () => {
      const children: string[] = [];
      for (const url of part.items) children.push(await retry(() => ig.createCarouselItem(url), sleep));
      return retry(() => ig.createCarousel(children, post.caption), sleep);
    }, sleep);
  }
  await ledger.put(key, JSON.stringify({ page: post.page, carousels: parts.length, at: new Date().toISOString() }));
  return { status: "published" as const, detail: `الصفحة ${post.page}` };
}

async function facebookPhotos(deps: MetaDeps, date: IsoDate, post: MetaPost) {
  const { ledger, sleep } = deps;
  const key = dayKey("facebook", date);
  if (await ledger.get(key)) return { status: "already" as const };
  if (deps.config.dryRun) {
    await deps.report(`🧪 فيسبوك (تجربة): الصفحة ${post.page}، منشور من ${post.facebook.length} صور`);
    return { status: "dry-run" as const };
  }
  const fb = configured(deps.facebook, "فيسبوك");

  const photoIds: string[] = [];
  for (const url of post.facebook) photoIds.push(await retry(() => fb.uploadHiddenPhoto(url), sleep));
  await postOnce(ledger, key, () => fb.postPhotos(post.caption, photoIds), sleep);
  return { status: "published" as const, detail: `الصفحة ${post.page}` };
}

/** 07:05 Mecca: the day's page and tafsir cards as an Instagram carousel and a Facebook photo post. */
export async function publishMetaMorning(deps: MetaDeps, now: Date): Promise<ChannelResult[]> {
  const { config } = deps;
  const instagram = publishGate(now, { enabled: config.instagramEnabled, dryRun: config.dryRun }, "INSTAGRAM_ENABLED");
  const facebook = publishGate(now, { enabled: config.facebookEnabled, dryRun: config.dryRun }, "FACEBOOK_ENABLED");
  if (!instagram.open && !facebook.open) return [{ channel: "instagram", ...off(instagram.reason) }, { channel: "facebook", ...off(facebook.reason) }];

  const page = instagram.open ? instagram.page : facebook.open ? facebook.page : 0;
  let post: MetaPost;
  try {
    post = await buildMetaPost(page, deps.fetchImpl);
  } catch (error) {
    // An unapproved page: neither channel may post.
    return [{ channel: "instagram", status: "failed", detail: message(error) }, { channel: "facebook", status: "failed", detail: message(error) }];
  }
  return [
    await run("instagram", async () => (instagram.open ? instagramCarousels(deps, instagram.date, post) : off(instagram.reason))),
    await run("facebook", async () => (facebook.open ? facebookPhotos(deps, facebook.date, post) : off(facebook.reason))),
  ];
}

/** 07:15 Mecca: the whole-page video on Facebook every day, and a reel on reel days. */
export async function publishMetaVideos(deps: MetaDeps, now: Date): Promise<ChannelResult[]> {
  const { config, ledger, fetchImpl, sleep } = deps;
  const videoOff = !config.videoEnabled && "النشر موقوف (META_VIDEO_ENABLED)";

  const facebookVideo = await run("facebook-video", async () => {
    const gate = publishGate(now, { enabled: config.facebookEnabled, dryRun: config.dryRun }, "FACEBOOK_ENABLED");
    if (!gate.open) return off(gate.reason);
    if (videoOff) return off(videoOff);
    const key = dayKey("facebook-video", gate.date);
    if (await ledger.get(key)) return { status: "already" as const };
    const video = await pageVideo(gate.page, "video.mp4", fetchImpl);
    if (!video) return off(`لا يوجد فيديو للصفحة ${gate.page} على الموقع`);
    const caption = await pageCaption(gate.page, fetchImpl);
    if (config.dryRun) {
      await deps.report(`🧪 فيديو فيسبوك (تجربة): ${video}`);
      return { status: "dry-run" as const };
    }
    const fb = configured(deps.facebook, "فيسبوك");
    await postOnce(ledger, key, () => fb.postVideo(video, caption), sleep);
    return { status: "published" as const, detail: `الصفحة ${gate.page}` };
  });

  const reel = await run("instagram-reel", async () => {
    const gate = publishGate(now, { enabled: config.instagramEnabled, dryRun: config.dryRun }, "INSTAGRAM_ENABLED");
    if (!gate.open) return off(gate.reason);
    if (videoOff) return off(videoOff);
    if (!isReelDay(gate.date)) return off("ليس يوم ريل");
    const key = dayKey("instagram-reel", gate.date);
    if (await ledger.get(key)) return { status: "already" as const };
    const video = await pageVideo(gate.page, "reel.mp4", fetchImpl);
    if (!video) return off(`لا يوجد ريل للصفحة ${gate.page} على الموقع`);
    const caption = await pageCaption(gate.page, fetchImpl);
    if (config.dryRun) {
      await deps.report(`🧪 ريل إنستغرام (تجربة): ${video}`);
      return { status: "dry-run" as const };
    }
    const ig = configured(deps.instagram, "إنستغرام");
    if (!(await ledger.get(`${key}:container`))) {
      const quota = await overQuota(ig, 1);
      if (quota) return { status: "over-quota" as const, detail: quota };
    }
    await publishOnce(ig, ledger, key, VIDEO_POLL, () => retry(() => ig.createReel(video, caption), sleep), sleep);
    return { status: "published" as const, detail: `الصفحة ${gate.page}` };
  });

  return [facebookVideo, reel];
}

/** 20:00 Mecca: the reminder story, and any reel that was still processing in the morning. */
export async function publishMetaEvening(deps: MetaDeps, now: Date): Promise<ChannelResult[]> {
  const { config, ledger, fetchImpl, sleep } = deps;
  const gate = publishGate(now, { enabled: config.instagramEnabled, dryRun: config.dryRun }, "INSTAGRAM_ENABLED");

  const story = await run("instagram-story", async () => {
    if (!gate.open) return off(gate.reason);
    const key = dayKey("instagram-story", gate.date);
    if (await ledger.get(key)) return { status: "already" as const };
    await assertStoryShape(fetchImpl);
    if (config.dryRun) {
      await deps.report(`🧪 ستوري إنستغرام (تجربة): ${STORY_URL}`);
      return { status: "dry-run" as const };
    }
    const ig = configured(deps.instagram, "إنستغرام");
    const quota = await overQuota(ig, 1);
    if (quota) return { status: "over-quota" as const, detail: quota };
    await publishOnce(ig, ledger, key, IMAGE_POLL, () => retry(() => ig.createStory(STORY_URL), sleep), sleep);
    return { status: "published" as const };
  });

  const reel = await run("instagram-reel", async () => {
    if (!gate.open || config.dryRun || !deps.instagram) return off("لا شيء للاستئناف");
    const result = await publishOnce(deps.instagram, ledger, dayKey("instagram-reel", gate.date), VIDEO_POLL, undefined, sleep);
    return result === "published" ? { status: "published" as const, detail: "اكتملت معالجته مساءً" } : off("لا شيء للاستئناف");
  });

  return [story, reel];
}

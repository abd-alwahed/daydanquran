import type { GraphClient } from "./graph";
import { wait, type Ledger } from "./ledger";

/**
 * Most items one carousel may hold (Instagram Content Publishing API, "Carousel posts").
 * This is a format rule, unlike the daily publishing limit, which is always queried.
 */
export const CAROUSEL_MAX_ITEMS = 10;

/** https://developers.facebook.com/docs/instagram-platform/reference/ig-container#fields */
export type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

/** A container that is still processing after the allowed polls. It is kept, and a later run resumes it. */
export class ContainerNotReadyError extends Error {}

export interface PollOptions {
  /** Waits between status checks. */
  intervalMs: number;
  maxPolls: number;
}

/** Images are ready almost at once; videos take minutes. */
export const IMAGE_POLL: PollOptions = { intervalMs: 2_000, maxPolls: 5 };
export const VIDEO_POLL: PollOptions = { intervalMs: 20_000, maxPolls: 30 };

const MAX_PUBLISH_ATTEMPTS = 3;

/**
 * Splits items into as few carousels as possible, keeping their order and balancing the sizes,
 * so no carousel ends up with a single item (a carousel needs at least two).
 */
export function splitIntoCarousels<T>(items: readonly T[], max = CAROUSEL_MAX_ITEMS): T[][] {
  const count = Math.ceil(items.length / max);
  const chunks: T[][] = [];
  let start = 0;
  for (let i = 0; i < count; i++) {
    const size = Math.ceil((items.length - start) / (count - i));
    chunks.push(items.slice(start, start + size));
    start += size;
  }
  return chunks;
}

/** One Instagram professional account, published to through the Facebook Page it is linked to. */
export class Instagram {
  constructor(
    private readonly graph: Pick<GraphClient, "get" | "post">,
    private readonly userId: string,
    private readonly sleep: (ms: number) => Promise<void> = wait,
  ) {
    if (!userId) throw new Error("INSTAGRAM_USER_ID غير موجود");
  }

  /** Posts the account may still publish in the current window, read from Meta (never assumed). */
  async remainingQuota(): Promise<number> {
    const { data } = await this.graph.get<{ data?: { config?: { quota_total?: number }; quota_usage?: number }[] }>(
      `${this.userId}/content_publishing_limit`,
      { fields: "config,quota_usage" },
    );
    const total = data?.[0]?.config?.quota_total;
    const used = data?.[0]?.quota_usage;
    if (typeof total !== "number" || typeof used !== "number") throw new Error("Instagram: content_publishing_limit بلا قيم");
    return total - used;
  }

  createCarouselItem(imageUrl: string): Promise<string> {
    return this.create({ image_url: imageUrl, is_carousel_item: true });
  }

  createCarousel(children: readonly string[], caption: string): Promise<string> {
    if (children.length < 2 || children.length > CAROUSEL_MAX_ITEMS) {
      throw new Error(`Instagram: الألبوم يحتاج ٢–${CAROUSEL_MAX_ITEMS} عناصر، وفيه ${children.length}`);
    }
    return this.create({ media_type: "CAROUSEL", children: children.join(","), caption });
  }

  createStory(imageUrl: string): Promise<string> {
    return this.create({ media_type: "STORIES", image_url: imageUrl });
  }

  createReel(videoUrl: string, caption: string): Promise<string> {
    return this.create({ media_type: "REELS", video_url: videoUrl, caption, share_to_feed: true });
  }

  async status(containerId: string): Promise<{ code: ContainerStatus; detail?: string }> {
    const result = await this.graph.get<{ status_code: ContainerStatus; status?: string }>(containerId, { fields: "status_code,status" });
    return { code: result.status_code, detail: result.status };
  }

  /** Polls until the container is FINISHED (or already PUBLISHED). */
  async waitUntilReady(containerId: string, poll: PollOptions): Promise<ContainerStatus> {
    for (let i = 1; ; i++) {
      const { code, detail } = await this.status(containerId);
      if (code === "FINISHED" || code === "PUBLISHED") return code;
      if (code === "ERROR" || code === "EXPIRED") throw new Error(`Instagram: الحاوية ${containerId} ${code}${detail ? `: ${detail}` : ""}`);
      if (i >= poll.maxPolls) throw new ContainerNotReadyError(`Instagram: الحاوية ${containerId} ما زالت قيد المعالجة`);
      await this.sleep(poll.intervalMs);
    }
  }

  /** Publishes a FINISHED container. Not idempotent on its own: use `publishOnce`. */
  async publish(containerId: string): Promise<string> {
    return (await this.graph.post<{ id: string }>(`${this.userId}/media_publish`, { creation_id: containerId })).id;
  }

  private async create(params: Record<string, string | boolean>): Promise<string> {
    return (await this.graph.post<{ id: string }>(`${this.userId}/media`, params)).id;
  }
}

export type PublishOnceResult = "published" | "already" | "nothing-to-resume";

/**
 * Publishes one container at most once, even across failed and repeated runs:
 * - `key` set in the ledger: already published, nothing happens;
 * - the container id is stored before publishing, and a later run asks Meta for its status first,
 *   so a publish whose answer was lost (timeout) is recognised as PUBLISHED instead of repeated;
 * - an EXPIRED or failed container is replaced by a new one.
 * Without `create`, only a stored container is resumed (e.g. a reel still processing).
 */
export async function publishOnce(
  ig: Instagram,
  ledger: Ledger,
  key: string,
  poll: PollOptions,
  create?: () => Promise<string>,
  sleep: (ms: number) => Promise<void> = wait,
): Promise<PublishOnceResult> {
  if (await ledger.get(key)) return "already";
  const containerKey = `${key}:container`;
  const done = async (mediaId?: string) => {
    await ledger.put(key, JSON.stringify({ container: containerId, mediaId, at: new Date().toISOString() }));
    return "published" as const;
  };

  let containerId = await ledger.get(containerKey);
  if (containerId) {
    const { code } = await ig.status(containerId);
    if (code === "PUBLISHED") return done();
    if (code === "ERROR" || code === "EXPIRED") containerId = null;
  }
  if (!containerId) {
    if (!create) return "nothing-to-resume";
    containerId = await create();
    await ledger.put(containerKey, containerId);
  }

  await ig.waitUntilReady(containerId, poll);
  for (let attempt = 1; ; attempt++) {
    try {
      return await done(await ig.publish(containerId));
    } catch (error) {
      // The publish may have gone through even if its answer did not arrive.
      if ((await ig.status(containerId).catch(() => null))?.code === "PUBLISHED") return done();
      if (attempt === MAX_PUBLISH_ATTEMPTS) throw error;
      await sleep(5_000 * attempt);
    }
  }
}

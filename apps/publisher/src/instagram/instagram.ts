/**
 * Instagram API with Instagram Login: publishes straight to the Instagram professional account,
 * with no Facebook Page (the Page could not be linked). Version: check
 * https://developers.facebook.com/docs/graph-api/changelog before it expires (about two years).
 */
export const INSTAGRAM_API = "https://graph.instagram.com/v25.0";

/** Instagram answered with an error, so the call did not take effect. */
export class InstagramError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
  }
}

/** https://developers.facebook.com/docs/instagram-platform/reference/ig-container#fields */
export type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

export interface PollOptions {
  intervalMs: number;
  maxPolls: number;
}

/** Images are usually ready at once. */
export const IMAGE_POLL: PollOptions = { intervalMs: 3_000, maxPolls: 5 };

const MAX_PUBLISH_ATTEMPTS = 3;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface ErrorBody {
  error?: { message?: string; code?: number; error_user_msg?: string };
}

/** The few calls we make, for one account. */
export class Instagram {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly token: string,
    private readonly userId: string,
    fetchImpl: typeof fetch = fetch,
    private readonly sleep: (ms: number) => Promise<void> = wait,
  ) {
    if (!token) throw new Error("توكن إنستغرام غير موجود (INSTAGRAM_ACCESS_TOKEN)");
    if (!userId) throw new Error("INSTAGRAM_USER_ID غير موجود");
    // Workers throw "Illegal invocation" when fetch is called as a method of another object.
    this.fetchImpl = (input, init) => fetchImpl(input, init);
  }

  /** Posts the account may still publish in the current window, read from Instagram (never assumed). */
  async remainingQuota(): Promise<number> {
    const { data } = await this.call<{ data?: { config?: { quota_total?: number }; quota_usage?: number }[] }>(
      "GET",
      `${this.userId}/content_publishing_limit?fields=config,quota_usage`,
    );
    const total = data?.[0]?.config?.quota_total;
    const used = data?.[0]?.quota_usage;
    if (typeof total !== "number" || typeof used !== "number") throw new Error("Instagram: content_publishing_limit بلا قيم");
    return total - used;
  }

  async createStory(imageUrl: string): Promise<string> {
    return (await this.call<{ id: string }>("POST", `${this.userId}/media`, { media_type: "STORIES", image_url: imageUrl })).id;
  }

  async status(containerId: string): Promise<ContainerStatus> {
    return (await this.call<{ status_code: ContainerStatus }>("GET", `${containerId}?fields=status_code`)).status_code;
  }

  /** Polls until the container is FINISHED (or already PUBLISHED). */
  async waitUntilReady(containerId: string, poll: PollOptions): Promise<ContainerStatus> {
    for (let i = 1; ; i++) {
      const code = await this.status(containerId);
      if (code === "FINISHED" || code === "PUBLISHED") return code;
      if (code === "ERROR" || code === "EXPIRED") throw new Error(`Instagram: الحاوية ${containerId} ${code}`);
      if (i >= poll.maxPolls) throw new Error(`Instagram: الحاوية ${containerId} ما زالت قيد المعالجة`);
      await this.sleep(poll.intervalMs);
    }
  }

  /** Publishes a FINISHED container. Not idempotent on its own: use `publishOnce`. */
  async publish(containerId: string): Promise<string> {
    return (await this.call<{ id: string }>("POST", `${this.userId}/media_publish`, { creation_id: containerId })).id;
  }

  private async call<T>(method: "GET" | "POST", path: string, params?: Record<string, string>): Promise<T> {
    // The token goes in a header, never in the URL, so it cannot leak into logs or error messages.
    const response = await this.fetchImpl(`${INSTAGRAM_API}/${path}`, {
      method,
      headers: { authorization: `Bearer ${this.token}` },
      body: params ? new URLSearchParams(params) : undefined,
    });
    const json = (await response.json().catch(() => ({}))) as T & ErrorBody;
    if (!response.ok || json.error) {
      const error = json.error ?? {};
      const detail = error.error_user_msg ?? error.message ?? `HTTP ${response.status}`;
      throw new InstagramError(`Instagram ${method} ${path.split("?")[0]}: ${detail}`, error.code ?? response.status);
    }
    return json;
  }
}

/** Where we record what was published (Workers KV in production). */
export interface Ledger {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

/**
 * Publishes one container at most once, even across failed and repeated runs:
 * - `key` set in the ledger: already published, nothing happens;
 * - the container id is stored before publishing, and a later run asks Instagram for its status first,
 *   so a publish whose answer was lost (timeout) is recognised as PUBLISHED instead of repeated;
 * - an EXPIRED or failed container is replaced by a new one.
 */
export async function publishOnce(
  ig: Instagram,
  ledger: Ledger,
  key: string,
  create: () => Promise<string>,
  poll: PollOptions = IMAGE_POLL,
  sleep: (ms: number) => Promise<void> = wait,
): Promise<"published" | "already"> {
  if (await ledger.get(key)) return "already";
  const containerKey = `${key}:container`;
  let containerId = await ledger.get(containerKey);
  const done = async (mediaId?: string) => {
    await ledger.put(key, JSON.stringify({ container: containerId, mediaId, at: new Date().toISOString() }));
    return "published" as const;
  };

  if (containerId) {
    const code = await ig.status(containerId);
    if (code === "PUBLISHED") return done();
    if (code === "ERROR" || code === "EXPIRED") containerId = null;
  }
  if (!containerId) {
    containerId = await create();
    await ledger.put(containerKey, containerId);
  }

  await ig.waitUntilReady(containerId, poll);
  for (let attempt = 1; ; attempt++) {
    try {
      return await done(await ig.publish(containerId));
    } catch (error) {
      // The publish may have gone through even if its answer did not arrive.
      if ((await ig.status(containerId).catch(() => null)) === "PUBLISHED") return done();
      if (attempt === MAX_PUBLISH_ATTEMPTS) throw error;
      await sleep(5_000 * attempt);
    }
  }
}

import { GRAPH_VIDEO_HOST, GraphError, type GraphClient } from "./graph";
import { wait, type Ledger } from "./ledger";

const MAX_ATTEMPTS = 3;

/** A Facebook post that may or may not have been published. Never retried automatically. */
export class UncertainPostError extends Error {}

/** One Facebook Page, published to with a Page access token. */
export class Facebook {
  constructor(
    private readonly graph: Pick<GraphClient, "post">,
    private readonly pageId: string,
  ) {
    if (!pageId) throw new Error("FACEBOOK_PAGE_ID غير موجود");
  }

  /** Uploads a photo without showing it, to attach to a post. Repeating it leaves only a hidden copy. */
  async uploadHiddenPhoto(url: string): Promise<string> {
    return (await this.graph.post<{ id: string }>(`${this.pageId}/photos`, { url, published: false })).id;
  }

  /** One post with several photos, in order. */
  async postPhotos(message: string, photoIds: readonly string[]): Promise<string> {
    const attached = Object.fromEntries(photoIds.map((id, i) => [`attached_media[${i}]`, JSON.stringify({ media_fbid: id })]));
    return (await this.graph.post<{ id: string }>(`${this.pageId}/feed`, { message, ...attached })).id;
  }

  /** A Page video, fetched by Meta from `fileUrl`. */
  async postVideo(fileUrl: string, description: string): Promise<string> {
    return (await this.graph.post<{ id: string }>(`${this.pageId}/videos`, { file_url: fileUrl, description }, GRAPH_VIDEO_HOST)).id;
  }
}

/**
 * Runs `post` at most once per `key`. Facebook has no container whose status could tell whether
 * a lost answer was published, so a "pending" mark is written first:
 * - Meta answered with an error: nothing was posted, the mark is cleared and the call retried;
 * - no answer at all (network): the mark stays, and every later run refuses with UncertainPostError
 *   until a person checks the Page and deletes `<key>:pending`.
 */
export async function postOnce(
  ledger: Ledger,
  key: string,
  post: () => Promise<string>,
  sleep: (ms: number) => Promise<void> = wait,
): Promise<"published" | "already"> {
  if (await ledger.get(key)) return "already";
  const pendingKey = `${key}:pending`;
  if (await ledger.get(pendingKey)) {
    throw new UncertainPostError(`لا نعرف إن نُشر ${key} في محاولة سابقة. تحقّق من الصفحة ثم احذف المفتاح ${pendingKey}`);
  }

  await ledger.put(pendingKey, new Date().toISOString());
  for (let attempt = 1; ; attempt++) {
    try {
      const id = await post();
      await ledger.put(key, JSON.stringify({ id, at: new Date().toISOString() }));
      await ledger.delete(pendingKey);
      return "published";
    } catch (error) {
      if (!(error instanceof GraphError)) throw error; // unknown outcome: keep the pending mark
      if (attempt === MAX_ATTEMPTS) {
        await ledger.delete(pendingKey);
        throw error;
      }
      await sleep(5_000 * attempt);
    }
  }
}

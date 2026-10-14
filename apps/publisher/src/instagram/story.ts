import { SITE_URL, type IsoDate } from "@daydan/core";
import { publishGate } from "../publish-gate";
import { publishOnce, type Instagram, type Ledger } from "./instagram";

/**
 * Instagram's copy of the page's story.png (packages/media): JPEG, the only image format its
 * publishing API accepts. Served by the site, so only approved pages can be posted.
 */
export const STORY_FILE = "ig-story.jpg";

export interface StoryDeps {
  /** Missing when its token or account id is not configured. */
  instagram?: Instagram;
  /** One key per Mecca date, shared with Telegram's KV namespace. */
  ledger: Ledger;
  config: { enabled: boolean; dryRun: boolean };
  /** A message to the admin chat (dry-run reports). */
  report: (text: string) => Promise<unknown>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export type StoryResult =
  | { status: "published" | "already" | "dry-run"; date: IsoDate; page: number }
  | { status: "skipped"; date: IsoDate; reason: string };

/** A JPEG's pixel size, read from its start-of-frame segment; throws if `bytes` is not a JPEG. */
export function jpegDimensions(bytes: Uint8Array, name: string): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    // Walk the segments to the first start-of-frame (SOF0–SOF15, except DHT, JPG and DAC).
    for (let at = 2; at + 9 <= bytes.length && bytes[at] === 0xff; at += 2 + view.getUint16(at + 2)) {
      const marker = bytes[at + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
      }
    }
  }
  throw new Error(`${name}: ليست صورة JPEG`);
}

/** Stories are 9:16: any other shape would be cropped, cutting into the Mushaf page. */
export function assertStoryShape({ width, height }: { width: number; height: number }, name: string): void {
  if (width * 16 !== height * 9) throw new Error(`${name}: ${width}×${height}، والستوري يجب أن يكون ٩:١٦`);
}

/** Reads a JPEG's pixel size from its first bytes, without downloading the whole file. */
export async function jpegSize(url: string, fetchImpl: typeof fetch = fetch): Promise<{ width: number; height: number }> {
  const response = await fetchImpl(url, { headers: { range: "bytes=0-4095" } });
  if (!response.ok) throw new Error(`${response.status} ${url}: الصفحة غير معتمدة أو غير منشورة على الموقع`);
  return jpegDimensions(new Uint8Array(await response.arrayBuffer()), url);
}

/** 07:01 Mecca: today's page as an Instagram story, at most once per day. */
export async function publishStory(deps: StoryDeps, now: Date): Promise<StoryResult> {
  const { config, ledger } = deps;
  const gate = publishGate(now, config, "INSTAGRAM_ENABLED");
  if (!gate.open) return { status: "skipped", date: gate.date, reason: gate.reason };
  const { date, page } = gate;
  const key = `published:instagram-story:${date}`;
  if (await ledger.get(key)) return { status: "already", date, page };

  const url = `${SITE_URL}/p/${page}/${STORY_FILE}`;
  assertStoryShape(await jpegSize(url, deps.fetchImpl), url);

  if (config.dryRun) {
    await deps.report(`🧪 ستوري إنستغرام (تجربة): الصفحة ${page}\n${url}`);
    return { status: "dry-run", date, page };
  }
  const ig = deps.instagram;
  if (!ig) throw new Error("إنستغرام غير مضبوط (INSTAGRAM_ACCESS_TOKEN أو INSTAGRAM_USER_ID)");
  const remaining = await ig.remainingQuota();
  if (remaining < 1) throw new Error(`لم يبقَ شيء من حد النشر في إنستغرام (content_publishing_limit)`);

  await publishOnce(ig, ledger, key, () => ig.createStory(url), undefined, deps.sleep);
  return { status: "published", date, page };
}

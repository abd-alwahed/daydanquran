import { LAUNCH_DATE, SITE_URL, localDate, pageForDate, type IsoDate } from "@daydan/core";
import { buildAlbum } from "./album";
import type { TelegramClient } from "./telegram";

export interface PublishDeps {
  telegram: Pick<TelegramClient, "sendMediaGroup">;
  /** Records what was published. Key per (channel, Mecca date) makes publishing idempotent. */
  publications: Pick<KVNamespace, "get" | "put">;
  config: { enabled: boolean; dryRun: boolean; channel: string; adminChatId: string };
  fetchImpl?: typeof fetch;
  /** Waits between retries. Injected so tests run instantly. */
  sleep?: (ms: number) => Promise<void>;
}

export type PublishResult =
  | { status: "published"; date: IsoDate; page: number; dryRun: boolean }
  | { status: "skipped"; date: IsoDate; reason: string };

const MAX_ATTEMPTS = 3;
const publicationKey = (date: IsoDate) => `published:telegram:${date}`;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Posts today's page to the Telegram channel at most once per day. */
export async function publishDaily(deps: PublishDeps, now: Date): Promise<PublishResult> {
  const { config, publications, telegram, fetchImpl = fetch, sleep = wait } = deps;
  const date = localDate(now);

  if (date < LAUNCH_DATE) return { status: "skipped", date, reason: "قبل يوم الإطلاق" };
  if (!config.enabled) return { status: "skipped", date, reason: "النشر موقوف (TELEGRAM_ENABLED)" };
  if (await publications.get(publicationKey(date))) return { status: "skipped", date, reason: "نُشر من قبل" };

  const { page } = pageForDate(LAUNCH_DATE, now);
  const album = await buildAlbum(SITE_URL, page, fetchImpl);
  const chatId = config.dryRun ? config.adminChatId : config.channel;

  for (let attempt = 1; ; attempt++) {
    try {
      await telegram.sendMediaGroup(chatId, album);
      break;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      await sleep(5_000 * attempt);
    }
  }

  // A dry run records nothing, so it never blocks the real post.
  if (!config.dryRun) await publications.put(publicationKey(date), JSON.stringify({ page, at: now.toISOString() }));
  return { status: "published", date, page, dryRun: config.dryRun };
}

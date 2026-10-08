import { LAUNCH_DATE, SITE_URL, localDate, pageForDate, type IsoDate } from "@daydan/core";
import { buildAlbums } from "./album";
import type { TelegramClient } from "./telegram";

export interface PublishDeps {
  telegram: Pick<TelegramClient, "sendMediaGroup">;
  /** Records what was published, per (channel, Mecca date) and per album, so nothing is posted twice. */
  publications: Pick<KVNamespace, "get" | "put">;
  config: { enabled: boolean; dryRun: boolean; channel: string; adminChatId: string };
  fetchImpl?: typeof fetch;
  /** Waits between retries. Injected so tests run instantly. */
  sleep?: (ms: number) => Promise<void>;
}

export type PublishResult =
  | { status: "published"; date: IsoDate; page: number; albums: number; dryRun: boolean }
  | { status: "skipped"; date: IsoDate; reason: string };

const MAX_ATTEMPTS = 3;
const dayKey = (date: IsoDate) => `published:telegram:${date}`;
const albumKey = (date: IsoDate, index: number) => `${dayKey(date)}:album:${index}`;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function withRetry(send: () => Promise<unknown>, sleep: (ms: number) => Promise<void>): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await send();
      return;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      await sleep(5_000 * attempt);
    }
  }
}

/**
 * Posts today's page to the Telegram channel at most once per day.
 * Each album is recorded as soon as it is sent, so a run that failed halfway resumes
 * with the next album instead of posting the first one again.
 */
export async function publishDaily(deps: PublishDeps, now: Date): Promise<PublishResult> {
  const { config, publications, telegram, fetchImpl = fetch, sleep = wait } = deps;
  const date = localDate(now);

  const beforeLaunch = date < LAUNCH_DATE;
  if (!config.enabled) return { status: "skipped", date, reason: "النشر موقوف (TELEGRAM_ENABLED)" };
  // Before launch only the dry run works: it rehearses day one (page 1) with the admin.
  if (beforeLaunch && !config.dryRun) return { status: "skipped", date, reason: "قبل يوم الإطلاق" };
  if (await publications.get(dayKey(date))) return { status: "skipped", date, reason: "نُشر من قبل" };

  const page = beforeLaunch ? 1 : pageForDate(LAUNCH_DATE, now).page;
  const albums = await buildAlbums(SITE_URL, page, fetchImpl);
  const chatId = config.dryRun ? config.adminChatId : config.channel;
  // A dry run records nothing, so it never blocks the real post.
  const record = (key: string, value: string) => (config.dryRun ? Promise.resolve() : publications.put(key, value));

  for (const [index, album] of albums.entries()) {
    if (!config.dryRun && (await publications.get(albumKey(date, index)))) continue;
    await withRetry(() => telegram.sendMediaGroup(chatId, album), sleep);
    await record(albumKey(date, index), now.toISOString());
  }

  await record(dayKey(date), JSON.stringify({ page, albums: albums.length, at: now.toISOString() }));
  return { status: "published", date, page, albums: albums.length, dryRun: config.dryRun };
}

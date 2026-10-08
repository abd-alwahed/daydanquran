import { LAUNCH_DATE, SITE_URL, localDate, pageForDate, type IsoDate } from "@daydan/core";
import { buildDailyPost, type PostPart } from "./daily-post";
import type { TelegramClient } from "./telegram";

export interface PublishDeps {
  telegram: Pick<TelegramClient, "sendPhoto" | "sendMediaGroup">;
  /** Records what was published, per (channel, Mecca date) and per message, so nothing is posted twice. */
  publications: Pick<KVNamespace, "get" | "put">;
  config: { enabled: boolean; dryRun: boolean; channel: string; adminChatId: string };
  fetchImpl?: typeof fetch;
  /** Waits between retries. Injected so tests run instantly. */
  sleep?: (ms: number) => Promise<void>;
}

export type PublishResult =
  | { status: "published"; date: IsoDate; page: number; messages: number; dryRun: boolean }
  | { status: "skipped"; date: IsoDate; reason: string };

const MAX_ATTEMPTS = 3;
const dayKey = (date: IsoDate) => `published:telegram:${date}`;
const partKey = (date: IsoDate, index: number) => `${dayKey(date)}:part:${index}`;
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

function send(telegram: PublishDeps["telegram"], chatId: string, part: PostPart): Promise<unknown> {
  return part.kind === "photo"
    ? telegram.sendPhoto(chatId, part.photo, { caption: part.caption, buttons: part.buttons })
    : telegram.sendMediaGroup(chatId, part.media);
}

/**
 * Posts today's page to the Telegram channel at most once per day.
 * Each message is recorded as soon as it is sent, so a run that failed halfway resumes
 * with the next message instead of posting the first one again.
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
  const parts = await buildDailyPost(SITE_URL, page, fetchImpl);
  const chatId = config.dryRun ? config.adminChatId : config.channel;
  // A dry run records nothing, so it never blocks the real post.
  const record = (key: string, value: string) => (config.dryRun ? Promise.resolve() : publications.put(key, value));

  for (const [index, part] of parts.entries()) {
    if (!config.dryRun && (await publications.get(partKey(date, index)))) continue;
    await withRetry(() => send(telegram, chatId, part), sleep);
    await record(partKey(date, index), now.toISOString());
  }

  await record(dayKey(date), JSON.stringify({ page, messages: parts.length, at: now.toISOString() }));
  return { status: "published", date, page, messages: parts.length, dryRun: config.dryRun };
}

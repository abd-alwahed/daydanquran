import { LAUNCH_DATE, SITE_URL, toArabicDigits, type IsoDate } from "@daydan/core";
import { publishGate } from "../publish-gate";
import type { TelegramClient } from "../telegram";
import type { Ledger } from "./instagram";
import { STORY_FILE } from "./story";

export interface StoryKitDeps {
  telegram: Pick<TelegramClient, "sendDocument">;
  ledger: Ledger;
  config: { enabled: boolean; adminChatId: string };
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export type StoryKitResult =
  | { status: "sent" | "already"; date: IsoDate; page: number }
  | { status: "skipped"; date: IsoDate; reason: string };

const MAX_ATTEMPTS = 3;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 07:01 Mecca: today's story image goes to the admin on Telegram, to share on Instagram and Facebook
 * stories by hand (Meta's developer platform is closed to the owner). Sent as a document so it keeps
 * its full 1080×1920 size. Once per Mecca date. Before launch it rehearses with page 1, marked as a test.
 */
export async function sendStoryKit(deps: StoryKitDeps, now: Date): Promise<StoryKitResult> {
  const { config, ledger, telegram, fetchImpl = fetch, sleep = wait } = deps;
  // Only the admin receives it, so the gate always runs as a dry run: before launch it sends page 1.
  const gate = publishGate(now, { enabled: config.enabled, dryRun: true }, "STORY_KIT_ENABLED");
  if (!gate.open) return { status: "skipped", date: gate.date, reason: gate.reason };
  const { date, page } = gate;
  const rehearsal = date < LAUNCH_DATE;
  const key = `sent:story-kit:${date}`;
  if (!rehearsal && (await ledger.get(key))) return { status: "already", date, page };

  const url = `${SITE_URL}/p/${page}/${STORY_FILE}`;
  const response = await fetchImpl(url);
  // A missing file means the page is not approved (not on the site). Never send around that.
  if (!response.ok) throw new Error(`${response.status} ${url}: الصفحة غير معتمدة أو غير منشورة على الموقع`);
  const image = await response.blob();

  const caption = [
    ...(rehearsal ? ["🧪 تجربة قبل الإطلاق، لا تنشرها"] : []),
    `ستوري اليوم: الصفحة ${toArabicDigits(page)}`,
    "انشرها على إنستغرام وفيسبوك، وأضف ملصق الرابط:",
    `${SITE_URL}/p/${page}/`,
  ].join("\n");

  for (let attempt = 1; ; attempt++) {
    try {
      await telegram.sendDocument(config.adminChatId, image, `daydan-${page}.jpg`, { caption });
      break;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      await sleep(5_000 * attempt);
    }
  }
  if (!rehearsal) await ledger.put(key, now.toISOString());
  return { status: "sent", date, page };
}

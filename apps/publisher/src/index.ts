import { Facebook, GraphClient, Instagram } from "@daydan/publishers";
import type { Env } from "./env";
import { needsAttention, publishMetaEvening, publishMetaMorning, publishMetaVideos, type ChannelResult, type MetaDeps } from "./meta/publish-meta";
import { publishDaily } from "./publish";
import { D1ReadingStore } from "./reading/d1-store";
import { D1ReminderStore } from "./reminders/d1-store";
import { sendDueReminders } from "./reminders/send-reminders";
import { TelegramClient } from "./telegram";
import { ALLOWED_UPDATES, handleWebhook } from "./webhook";
import { webhookSecret } from "./webhook-secret";

const WEBHOOK_PATH = "/telegram/webhook";
/**
 * wrangler.toml [triggers]. Each cron is its own invocation with its own subrequest budget,
 * so Telegram, Meta images and Meta videos never share one.
 */
const CRONS = {
  telegram: "0 4 * * *", // 07:00 Mecca
  metaImages: "5 4 * * *", // 07:05
  metaVideos: "15 4 * * *", // 07:15
  metaEvening: "0 17 * * *", // 20:00
  // every other cron: the reminder sweep
} as const;

// Secrets pasted into a terminal can carry a trailing newline or space, which breaks the API URL.
const botToken = (env: Env) => env.TELEGRAM_BOT_TOKEN.trim();
const adminChatId = (env: Env) => env.ADMIN_CHAT_ID.trim();

const alertAdmin = (telegram: TelegramClient, env: Env, what: string, error: unknown) =>
  telegram
    .sendMessage(adminChatId(env), `⚠️ دَيْدَن: ${what}\n${error instanceof Error ? error.message : String(error)}`)
    .catch(() => {});

async function runScheduled(env: Env, now: Date): Promise<void> {
  const telegram = new TelegramClient(botToken(env));

  // Re-registering is idempotent and keeps the read button working if the URL or secret ever changes.
  // A failure here must not block the day's post, so it is reported and the run continues.
  await telegram
    .setWebhook(env.WEBHOOK_URL, await webhookSecret(botToken(env)), ALLOWED_UPDATES)
    .catch((error: unknown) => alertAdmin(telegram, env, "فشل تسجيل زر «قرأت» (webhook)", error));

  try {
    const result = await publishDaily(
      {
        telegram,
        publications: env.PUBLICATIONS,
        config: {
          enabled: env.TELEGRAM_ENABLED === "1",
          dryRun: env.PUBLISH_DRY_RUN === "1",
          channel: env.TELEGRAM_CHANNEL,
          adminChatId: adminChatId(env),
        },
      },
      now,
    );
    console.log(JSON.stringify(result));
  } catch (error) {
    await alertAdmin(telegram, env, "فشل نشر تيليجرام", error);
    throw error;
  }
}

async function runReminders(env: Env, now: Date): Promise<void> {
  const telegram = new TelegramClient(botToken(env));
  const result = await sendDueReminders(
    {
      store: new D1ReminderStore(env.DB),
      telegram,
      config: { enabled: env.REMINDERS_ENABLED === "1", dryRun: env.PUBLISH_DRY_RUN === "1", adminChatId: adminChatId(env) },
    },
    now,
  ).catch(async (error: unknown) => {
    await alertAdmin(telegram, env, "فشلت جولة التذكيرات", error);
    throw error;
  });
  console.log(JSON.stringify(result));
  // Failed sends are released and retried by the next run (15 minutes later).
  if (result.status === "done" && result.failed > 0) {
    await alertAdmin(telegram, env, "تعذّر إرسال بعض التذكيرات", `${result.failed} تذكير، ستُعاد المحاولة في الجولة التالية`);
  }
}

function metaDeps(env: Env, telegram: TelegramClient): MetaDeps {
  const token = env.META_ACCESS_TOKEN?.trim();
  const graph = token ? new GraphClient(token) : undefined;
  const instagramId = env.INSTAGRAM_USER_ID?.trim();
  const pageId = env.FACEBOOK_PAGE_ID?.trim();
  return {
    instagram: graph && instagramId ? new Instagram(graph, instagramId) : undefined,
    facebook: graph && pageId ? new Facebook(graph, pageId) : undefined,
    ledger: env.PUBLICATIONS,
    config: {
      instagramEnabled: env.INSTAGRAM_ENABLED === "1",
      facebookEnabled: env.FACEBOOK_ENABLED === "1",
      videoEnabled: env.META_VIDEO_ENABLED === "1",
      dryRun: env.PUBLISH_DRY_RUN === "1" || env.META_DRY_RUN === "1",
    },
    report: (text) => telegram.sendMessage(adminChatId(env), text),
  };
}

async function runMeta(env: Env, job: (deps: MetaDeps, now: Date) => Promise<ChannelResult[]>, now: Date): Promise<void> {
  const telegram = new TelegramClient(botToken(env));
  const results = await job(metaDeps(env, telegram), now);
  console.log(JSON.stringify(results));
  for (const r of results.filter(needsAttention)) await alertAdmin(telegram, env, `نشر ${r.channel}: ${r.status}`, r.detail);
}

function runCron(cron: string, env: Env, now: Date): Promise<void> {
  switch (cron) {
    case CRONS.telegram:
      return runScheduled(env, now);
    case CRONS.metaImages:
      return runMeta(env, publishMetaMorning, now);
    case CRONS.metaVideos:
      return runMeta(env, publishMetaVideos, now);
    case CRONS.metaEvening:
      return runMeta(env, publishMetaEvening, now);
    default:
      return runReminders(env, now);
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method !== "POST" || pathname !== WEBHOOK_PATH) return new Response("Not found", { status: 404 });
    return handleWebhook(request, {
      telegram: new TelegramClient(botToken(env)),
      store: new D1ReadingStore(env.DB),
      reminders: new D1ReminderStore(env.DB),
      expectedSecret: await webhookSecret(botToken(env)),
      now: () => new Date(),
    });
  },
  scheduled(controller, env, ctx) {
    const now = new Date(controller.scheduledTime);
    ctx.waitUntil(runCron(controller.cron, env, now));
  },
} satisfies ExportedHandler<Env>;

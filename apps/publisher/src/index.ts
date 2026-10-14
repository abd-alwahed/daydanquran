import type { Env } from "./env";
import { Instagram } from "./instagram/instagram";
import { publishStory } from "./instagram/story";
import { sendStoryKit } from "./instagram/story-kit";
import { instagramToken } from "./instagram/token";
import { publishDaily } from "./publish";
import { D1ReadingStore } from "./reading/d1-store";
import { D1ReminderStore } from "./reminders/d1-store";
import { sendDueReminders } from "./reminders/send-reminders";
import { TelegramClient } from "./telegram";
import { ALLOWED_UPDATES, handleWebhook } from "./webhook";
import { webhookSecret } from "./webhook-secret";

const WEBHOOK_PATH = "/telegram/webhook";
/**
 * wrangler.toml [triggers]: the daily Telegram post (07:00 Mecca), the story image for the admin and the
 * Instagram story (07:01, its own invocation so neither can hold the Telegram post back); every other
 * cron is the reminder sweep.
 */
const DAILY_POST_CRON = "0 4 * * *";
const INSTAGRAM_STORY_CRON = "1 4 * * *";

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

async function runInstagramStory(env: Env, now: Date): Promise<void> {
  const telegram = new TelegramClient(botToken(env));
  try {
    // Refreshed whatever the switches say, so the token never expires while the story is off.
    const token = await instagramToken(env.PUBLICATIONS, env.INSTAGRAM_ACCESS_TOKEN, now);
    if (token?.warning) await alertAdmin(telegram, env, "تجديد توكن إنستغرام", token.warning);
    const userId = env.INSTAGRAM_USER_ID?.trim();
    const result = await publishStory(
      {
        instagram: token && userId ? new Instagram(token.token, userId) : undefined,
        ledger: env.PUBLICATIONS,
        config: {
          enabled: env.INSTAGRAM_ENABLED === "1",
          dryRun: env.PUBLISH_DRY_RUN === "1" || env.INSTAGRAM_DRY_RUN === "1",
        },
        report: (text) => telegram.sendMessage(adminChatId(env), text),
      },
      now,
    );
    console.log(JSON.stringify(result));
  } catch (error) {
    await alertAdmin(telegram, env, "فشل نشر ستوري إنستغرام", error);
    throw error;
  }
}

async function runStoryKit(env: Env, now: Date): Promise<void> {
  const telegram = new TelegramClient(botToken(env));
  try {
    const result = await sendStoryKit(
      { telegram, ledger: env.PUBLICATIONS, config: { enabled: env.STORY_KIT_ENABLED === "1", adminChatId: adminChatId(env) } },
      now,
    );
    console.log(JSON.stringify(result));
  } catch (error) {
    await alertAdmin(telegram, env, "تعذّر إرسال صورة ستوري اليوم", error);
    throw error;
  }
}

function runCron(cron: string, env: Env, now: Date): Promise<void> {
  if (cron === DAILY_POST_CRON) return runScheduled(env, now);
  // Independent jobs: one failing never stops the other.
  if (cron === INSTAGRAM_STORY_CRON) return Promise.allSettled([runStoryKit(env, now), runInstagramStory(env, now)]).then(() => {});
  return runReminders(env, now);
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

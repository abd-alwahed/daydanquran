import type { Env } from "./env";
import { publishDaily } from "./publish";
import { D1ReadingStore } from "./reading/d1-store";
import { D1ReminderStore } from "./reminders/d1-store";
import { sendDueReminders } from "./reminders/send-reminders";
import { TelegramClient } from "./telegram";
import { ALLOWED_UPDATES, handleWebhook } from "./webhook";
import { webhookSecret } from "./webhook-secret";

const WEBHOOK_PATH = "/telegram/webhook";
/** wrangler.toml [triggers]: the daily post; every other cron is the reminder sweep. */
const DAILY_POST_CRON = "0 4 * * *";

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
    ctx.waitUntil(controller.cron === DAILY_POST_CRON ? runScheduled(env, now) : runReminders(env, now));
  },
} satisfies ExportedHandler<Env>;

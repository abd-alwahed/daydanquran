import type { Env } from "./env";
import { publishDaily } from "./publish";
import { TelegramClient } from "./telegram";

async function run(env: Env, now: Date): Promise<void> {
  const telegram = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
  try {
    const result = await publishDaily(
      {
        telegram,
        publications: env.PUBLICATIONS,
        config: {
          enabled: env.TELEGRAM_ENABLED === "1",
          dryRun: env.PUBLISH_DRY_RUN === "1",
          channel: env.TELEGRAM_CHANNEL,
          adminChatId: env.ADMIN_CHAT_ID,
        },
      },
      now,
    );
    console.log(JSON.stringify(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await telegram.sendMessage(env.ADMIN_CHAT_ID, `⚠️ دَيْدَن: فشل نشر تيليجرام\n${message}`).catch(() => {});
    throw error;
  }
}

export default {
  scheduled(controller, env, ctx) {
    ctx.waitUntil(run(env, new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<Env>;

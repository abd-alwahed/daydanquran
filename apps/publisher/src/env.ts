/** Worker bindings and variables (see wrangler.toml). */
export interface Env {
  PUBLICATIONS: KVNamespace;
  /** Reading progress (migrations/). */
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHANNEL: string;
  ADMIN_CHAT_ID: string;
  /** This Worker's public webhook URL, registered with Telegram on every scheduled run. */
  WEBHOOK_URL: string;
  /** "1" to publish. Anything else is the kill switch. */
  TELEGRAM_ENABLED: string;
  /** "1" sends the post to ADMIN_CHAT_ID instead of the channel and records nothing; reminders go to ADMIN_CHAT_ID only. */
  PUBLISH_DRY_RUN: string;
  /** "1" sends personal reminders. Anything else is their kill switch. */
  REMINDERS_ENABLED: string;
  /** "1" sends today's story image to ADMIN_CHAT_ID at 07:01 Mecca, to share on Instagram/Facebook by hand. */
  STORY_KIT_ENABLED: string;
  /** "1" posts today's page as an Instagram story at 07:01 Mecca. Anything else is its kill switch. */
  INSTAGRAM_ENABLED: string;
  /** "1" keeps the story in dry-run mode (report to ADMIN_CHAT_ID, no Instagram call) even after PUBLISH_DRY_RUN is off. */
  INSTAGRAM_DRY_RUN: string;
  /** The Instagram professional account's id (not its @username). */
  INSTAGRAM_USER_ID: string;
  /** First long-lived Instagram User token (secret). Refreshed copies live in PUBLICATIONS KV. */
  INSTAGRAM_ACCESS_TOKEN?: string;
}

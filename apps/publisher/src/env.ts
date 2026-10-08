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
  /** "1" sends the post to ADMIN_CHAT_ID instead of the channel and records nothing. */
  PUBLISH_DRY_RUN: string;
}

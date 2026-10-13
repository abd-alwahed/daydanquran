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
  /** Long-lived Page access token of the Facebook Page linked to the Instagram account (secret). */
  META_ACCESS_TOKEN?: string;
  FACEBOOK_PAGE_ID: string;
  /** The Instagram professional account's id (not its @username). */
  INSTAGRAM_USER_ID: string;
  /** "1" to publish. Anything else is the kill switch of that channel. */
  INSTAGRAM_ENABLED: string;
  FACEBOOK_ENABLED: string;
  /** "1" adds reels and the Facebook page video to the enabled channels. */
  META_VIDEO_ENABLED: string;
  /** "1" keeps Meta in dry-run mode (reports to ADMIN_CHAT_ID, calls no Meta API) even after PUBLISH_DRY_RUN is off. */
  META_DRY_RUN: string;
}

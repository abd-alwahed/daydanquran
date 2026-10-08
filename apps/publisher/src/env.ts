/** Worker bindings and variables (see wrangler.toml). */
export interface Env {
  PUBLICATIONS: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHANNEL: string;
  ADMIN_CHAT_ID: string;
  /** "1" to publish. Anything else is the kill switch. */
  TELEGRAM_ENABLED: string;
  /** "1" sends the album to ADMIN_CHAT_ID instead of the channel and records nothing. */
  PUBLISH_DRY_RUN: string;
}

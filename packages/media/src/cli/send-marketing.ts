/**
 * Sends the Instagram/Facebook plan to a Telegram group, day by day: heading, images as files (full
 * quality), caption to copy, note. Render the images first (render:marketing).
 *   pnpm --filter @daydan/media send:marketing [--from 2026-10-21]
 * Reads TELEGRAM_BOT_TOKEN and MARKETING_CHAT_ID from the repo's .env (never committed).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLAN } from "../marketing/plan";
import { entryMessages, type Outgoing } from "../marketing/telegram";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const OUT = path.join(ROOT, "marketing/launch-2026");
/** Telegram allows about 20 messages a minute to one group. */
const PAUSE_MS = 3500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing: add it to ${path.join(ROOT, ".env")}`);
  return value;
}

async function call(token: string, method: string, body: FormData): Promise<void> {
  for (;;) {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body });
    const result = (await response.json()) as {
      ok: boolean;
      description?: string;
      parameters?: { retry_after?: number };
    };
    if (result.ok) return;
    const wait = result.parameters?.retry_after;
    if (!wait) throw new Error(`${method}: ${result.description ?? response.status}`);
    console.log(`  Telegram asks to wait ${wait}s`);
    await sleep(wait * 1000);
  }
}

async function send(token: string, chatId: string, message: Outgoing): Promise<void> {
  const body = new FormData();
  body.set("chat_id", chatId);
  if ("text" in message) {
    body.set("text", message.text);
    body.set("link_preview_options", JSON.stringify({ is_disabled: true }));
    return call(token, "sendMessage", body);
  }
  const attach = async (field: string, file: string) =>
    body.set(field, new Blob([await fs.readFile(file)], { type: "image/png" }), path.basename(file));
  // An album needs at least two files: a single image goes as a plain document.
  if (message.files.length === 1) {
    await attach("document", message.files[0]!);
    return call(token, "sendDocument", body);
  }
  for (const [i, file] of message.files.entries()) await attach(`f${i}`, file);
  body.set(
    "media",
    JSON.stringify(message.files.map((_, i) => ({ type: "document", media: `attach://f${i}` }))),
  );
  return call(token, "sendMediaGroup", body);
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(path.join(ROOT, ".env"));
  } catch {
    // No .env: the variables may come from the shell.
  }
  const token = env("TELEGRAM_BOT_TOKEN");
  const chatId = env("MARKETING_CHAT_ID");
  const fromIndex = process.argv.indexOf("--from");
  const from = fromIndex > 0 ? process.argv[fromIndex + 1]! : "";

  const entries = PLAN.filter((e) => e.date >= from);
  const messages = entries.flatMap((e) => entryMessages(e, OUT).map((m) => ({ date: e.date, m })));
  for (const { m } of messages) for (const f of "files" in m ? m.files : []) await fs.access(f);

  console.log(
    `${entries.length} entries, ${messages.length} messages, about ${Math.ceil((messages.length * PAUSE_MS) / 60000)} min`,
  );
  for (const [i, { date, m }] of messages.entries()) {
    try {
      await send(token, chatId, m);
    } catch (error) {
      throw new Error(`Stopped at ${date}. Resume with: --from ${date}`, { cause: error });
    }
    console.log(`✅ ${i + 1}/${messages.length} ${date}`);
    await sleep(PAUSE_MS);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

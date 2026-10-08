/**
 * The secret Telegram sends back in every webhook call (X-Telegram-Bot-Api-Secret-Token),
 * derived from the bot token so there is no second secret to manage.
 * Telegram allows 1–256 characters from A–Z, a–z, 0–9, "_" and "-": a hex digest fits.
 */
export async function webhookSecret(botToken: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`daydan-webhook:${botToken}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison, so the secret cannot be guessed from response timing. */
export function secretsMatch(received: string | null, expected: string): boolean {
  if (received === null || received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

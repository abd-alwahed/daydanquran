/**
 * A long-lived Instagram User token lasts 60 days and can be refreshed once it is a day old.
 * The Worker cannot change its own secrets, so the secret INSTAGRAM_ACCESS_TOKEN is only the first
 * token: every refreshed one is kept in KV and used from then on, until a new secret is put.
 */
const TOKEN_KEY = "instagram:token";
/** Refresh weekly: far from the 60-day expiry, and never before the required 24 hours. */
const REFRESH_AFTER_MS = 7 * 24 * 3_600_000;

interface StoredToken {
  token: string;
  refreshedAt: string;
  /** SHA-256 of the secret this token descends from: a different secret means the admin put a new one. */
  secret: string;
}

export interface TokenStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The token to use now, refreshed when it is a week old (or of unknown age, i.e. a new secret).
 * A failed refresh does not stop publishing: the current token is still valid for weeks, so it is
 * used and the failure is returned as a warning for the admin (it never contains the token).
 */
export async function instagramToken(
  store: TokenStore,
  secret: string | undefined,
  now: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<{ token: string; warning?: string } | null> {
  const seed = secret?.trim();
  if (!seed) return null;
  const seedHash = await sha256(seed);
  const raw = await store.get(TOKEN_KEY);
  const stored = raw ? (JSON.parse(raw) as StoredToken) : null;
  const current = stored?.secret === seedHash ? stored : { token: seed };
  if ("refreshedAt" in current && now.getTime() - Date.parse(current.refreshedAt) < REFRESH_AFTER_MS) return { token: current.token };

  // This endpoint takes the token only as a query parameter: never log this URL.
  const query = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: current.token });
  const response = await fetchImpl(`https://graph.instagram.com/refresh_access_token?${query}`);
  const json = (await response.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
  if (!response.ok || !json.access_token) {
    return { token: current.token, warning: `تعذّر تجديد توكن إنستغرام: ${json.error?.message ?? `HTTP ${response.status}`}` };
  }
  const next: StoredToken = { token: json.access_token, refreshedAt: now.toISOString(), secret: seedHash };
  await store.put(TOKEN_KEY, JSON.stringify(next));
  return { token: next.token };
}

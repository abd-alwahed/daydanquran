/** Where publishers record what they already did, so a re-run never posts twice (Workers KV in production). */
export interface Ledger {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs a call that is safe to repeat up to three times, waiting longer after each failure. */
export async function retry<T>(call: () => Promise<T>, sleep: (ms: number) => Promise<void> = wait): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(5_000 * attempt);
    }
  }
}

/** An in-memory ledger for tests and dry runs. */
export function memoryLedger(): Ledger & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    get: async (key) => entries.get(key) ?? null,
    put: async (key, value) => void entries.set(key, value),
    delete: async (key) => void entries.delete(key),
  };
}

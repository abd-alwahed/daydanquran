import fs from "node:fs/promises";
import path from "node:path";
import { CACHE_DIR } from "./paths";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_ATTEMPTS = 4;
const POLITE_DELAY_MS = 200;

/**
 * Fetches `url` once and keeps the response under content/cache/<name>.
 * Re-runs read from disk, so the pipeline is reproducible and gentle on the APIs.
 */
export async function cachedFetch(name: string, url: string): Promise<Buffer> {
  const file = path.join(CACHE_DIR, name);
  try {
    return await fs.readFile(file);
  } catch {
    // Not cached yet.
  }
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url);
    if (response.ok) {
      const body = Buffer.from(await response.arrayBuffer());
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, body);
      await sleep(POLITE_DELAY_MS);
      return body;
    }
    if (attempt === MAX_ATTEMPTS) throw new Error(`${response.status} ${url}`);
    await sleep(1000 * 2 ** attempt);
  }
}

export const cachedText = async (name: string, url: string): Promise<string> => (await cachedFetch(name, url)).toString("utf8");

export const cachedJson = async <T>(name: string, url: string): Promise<T> => JSON.parse(await cachedText(name, url)) as T;

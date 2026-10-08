import fs from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import type { Manifest } from "./freeze";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

const ENV = {
  accountId: "R2_ACCOUNT_ID",
  accessKeyId: "R2_ACCESS_KEY_ID",
  secretAccessKey: "R2_SECRET_ACCESS_KEY",
  bucket: "R2_BUCKET",
} as const;

export function r2ConfigFromEnv(env: NodeJS.ProcessEnv): R2Config {
  const missing = Object.values(ENV).filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`Missing env for R2 upload: ${missing.join(", ")}`);
  return Object.fromEntries(Object.entries(ENV).map(([key, name]) => [key, env[name]!.trim()])) as unknown as R2Config;
}

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

export interface UploadResult {
  uploaded: number;
  skipped: number;
}

/**
 * Uploads every manifest file to `<release>/<page>/<file>`. Frozen objects are never overwritten:
 * an object that already exists is skipped when its sha256 matches and is an error when it does not.
 * manifest.json and report.json are rewritten, since they grow as pages are frozen.
 */
export async function uploadRelease(
  config: R2Config,
  releaseDir: string,
  manifest: Manifest,
  onProgress: (done: number, total: number) => void = () => {},
): Promise<UploadResult> {
  const aws = new AwsClient({ accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, service: "s3", region: "auto" });
  const base = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${manifest.release}`;

  const put = async (key: string, sha256?: string) => {
    const body = await fs.readFile(path.join(releaseDir, key));
    const headers: Record<string, string> = { "content-type": CONTENT_TYPES[path.extname(key)] ?? "application/octet-stream" };
    if (sha256) headers["x-amz-meta-sha256"] = sha256;
    const res = await aws.fetch(`${base}/${key}`, { method: "PUT", body, headers });
    if (!res.ok) throw new Error(`PUT ${key}: ${res.status} ${await res.text()}`);
  };

  const entries = Object.entries(manifest.files);
  const result: UploadResult = { uploaded: 0, skipped: 0 };
  let done = 0;
  const queue = [...entries];
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const [key, { sha256 }] = next;
        const head = await aws.fetch(`${base}/${key}`, { method: "HEAD" });
        if (head.ok) {
          const remote = head.headers.get("x-amz-meta-sha256");
          if (remote !== sha256) throw new Error(`${key} is already in R2 with a different hash (${remote ?? "none"}). Changes need a new release.`);
          result.skipped++;
        } else if (head.status === 404) {
          await put(key, sha256);
          result.uploaded++;
        } else {
          throw new Error(`HEAD ${key}: ${head.status}`);
        }
        onProgress(++done, entries.length);
      }
    }),
  );

  await put("report.json");
  await put("manifest.json");
  return result;
}

/**
 * Freezes approved, rendered pages into content/v1/<page>/ and writes manifest.json (sha256 per file)
 * and report.json. Only pages in content/approved.json are frozen.
 *   pnpm --filter @daydan/content freeze 1 5
 *   pnpm --filter @daydan/content freeze 1 604 --upload    also uploads to R2 (R2_* in .env)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { TOTAL_PAGES } from "@daydan/core";
import { MANIFEST_FILE, RELEASE_DIR, RELEASE_REPORT_FILE, buildManifest, buildReport, freezePage } from "../freeze";
import { REPO_ROOT, pageDir } from "../paths";
import { r2ConfigFromEnv, uploadRelease } from "../r2";
import { readApprovedPages } from "../store";

function parseArgs(argv: string[]) {
  const [from = 1, to = from] = argv.filter((a) => !a.startsWith("--")).map(Number);
  if (!(from >= 1 && to <= TOTAL_PAGES && from <= to)) throw new Error("Usage: freeze <from> [to] [--upload]");
  return { from, to, upload: argv.includes("--upload") };
}

async function main(): Promise<void> {
  const { from, to, upload } = parseArgs(process.argv.slice(2));
  const approved = new Set(await readApprovedPages());
  const pages = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const unapproved = pages.filter((p) => !approved.has(p));
  if (unapproved.length) throw new Error(`صفحات غير معتمدة في content/approved.json، لا تُجمَّد: ${unapproved.join(", ")}`);

  let written = 0;
  for (const page of pages) written += await freezePage(pageDir(page), path.join(RELEASE_DIR, String(page)));

  const manifest = await buildManifest(RELEASE_DIR);
  const report = buildReport(manifest);
  await fs.writeFile(path.join(RELEASE_DIR, MANIFEST_FILE), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(RELEASE_DIR, RELEASE_REPORT_FILE), JSON.stringify(report, null, 2));
  console.log(`✅ ${pages.length} صفحة، ${written} ملف جديد. الإصدار فيه ${manifest.pages.length} صفحة (${(report.totalBytes / 1e6).toFixed(1)} MB)`);

  if (!upload) return;
  try {
    process.loadEnvFile(path.join(REPO_ROOT, ".env"));
  } catch {
    // No .env: use the process environment.
  }
  const result = await uploadRelease(r2ConfigFromEnv(process.env), RELEASE_DIR, manifest, (done, total) => process.stdout.write(`\r${done}/${total}`));
  console.log(`\n✅ R2: ${result.uploaded} رُفع، ${result.skipped} موجود مسبقاً بنفس البصمة`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

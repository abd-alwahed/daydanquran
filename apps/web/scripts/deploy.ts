/** Deploys out/ to Cloudflare Pages, refusing a preview build (one that contains unapproved pages). */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PublishedIndex } from "../src/lib/published-pages";

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../out");
const index = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "p", "index.json"), "utf8")) as PublishedIndex;

if (index.preview) {
  console.error("❌ هذا بناء معاينة فيه صفحات غير معتمدة. ابنِ من جديد بـ `pnpm build` ثم انشر.");
  process.exit(1);
}

// One command string (no argument array) because Windows needs a shell to find wrangler.cmd.
execSync(`wrangler pages deploy "${OUT_DIR}" --project-name daydanquran --branch main`, { stdio: "inherit" });

import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root, resolved from this file so it works from any working directory. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const CONTENT_DIR = path.join(REPO_ROOT, "content");
export const CACHE_DIR = path.join(CONTENT_DIR, "cache");
export const BUILD_DIR = path.join(CONTENT_DIR, "build");
export const PAGES_DIR = path.join(BUILD_DIR, "pages");
export const REPORT_FILE = path.join(BUILD_DIR, "report.json");
export const APPROVED_FILE = path.join(CONTENT_DIR, "approved.json");

export const pageDir = (page: number): string => path.join(PAGES_DIR, String(page));

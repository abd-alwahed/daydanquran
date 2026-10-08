import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../templates");

export const loadTemplate = (name: string): Promise<string> => fs.readFile(path.join(TEMPLATES_DIR, name), "utf8");

/**
 * Replaces each occurrence of `placeholder`, in order, with the given values.
 * Throws when the counts differ, so a changed template can never silently drop a field.
 */
export function fill(html: string, placeholder: string, ...values: string[]): string {
  const parts = html.split(placeholder);
  if (parts.length - 1 !== values.length) {
    throw new Error(`"${placeholder}" appears ${parts.length - 1} times, expected ${values.length}`);
  }
  return parts.reduce((out, part, i) => out + values[i - 1] + part);
}

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

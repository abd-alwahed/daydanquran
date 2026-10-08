import { TOTAL_PAGES } from "@daydan/core";
import type { InlineButton } from "./telegram";

const PREFIX = "read:";

/** The "قرأت الورد" button under a page post. Its callback data names the page. */
export const readButton = (page: number): InlineButton => ({ text: "قرأت الورد ✅", callback_data: `${PREFIX}${page}` });

/** The page in a button's callback data, or null for anything that is not a valid read button. */
export function parseReadButton(data: string | undefined): number | null {
  if (!data?.startsWith(PREFIX)) return null;
  const page = Number(data.slice(PREFIX.length));
  return Number.isInteger(page) && page >= 1 && page <= TOTAL_PAGES ? page : null;
}

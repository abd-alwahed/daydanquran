"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pageRange, readBuiltPages, setPageApproval } from "@daydan/content";
import { queueUrl } from "./review";

/** Approving needs the page's images: a page without them could not be reviewed. */
async function assertBuilt(pages: readonly number[]): Promise<void> {
  const built = new Set(await readBuiltPages());
  const missing = pages.filter((p) => !built.has(p));
  if (missing.length) throw new Error(`لا يمكن اعتماد صفحات لم تُولَّد صورها بعد: ${missing.join(", ")}`);
}

/**
 * Saves a review decision to content/approved.json. Only reachable from /admin, which exists
 * only in `next dev`. The page goes live once that file is committed and the site is rebuilt.
 */
export async function setApproval(page: number, approved: boolean): Promise<void> {
  if (approved) await assertBuilt([page]);
  await setPageApproval(page, approved);
  revalidatePath("/admin", "layout");
}

/** Review queue: approves the page and opens the next unapproved one after it. */
export async function approveAndNext(page: number, flagged: boolean): Promise<void> {
  await setApproval(page, true);
  redirect(queueUrl(page, flagged));
}

/** Approves pages the owner has already reviewed, `from` to `to` inclusive. */
export async function approveRange(formData: FormData): Promise<void> {
  const pages = pageRange(Number(formData.get("from")), Number(formData.get("to")));
  await assertBuilt(pages);
  await setPageApproval(pages, true);
  revalidatePath("/admin", "layout");
}

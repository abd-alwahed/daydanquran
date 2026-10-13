"use server";

import { revalidatePath } from "next/cache";
import { readBuiltPages, setPageApproval } from "@daydan/content";

/**
 * Saves a review decision to content/approved.json. Only reachable from /admin, which exists
 * only in `next dev`. The page goes live once that file is committed and the site is rebuilt.
 */
export async function setApproval(page: number, approved: boolean): Promise<void> {
  if (approved && !(await readBuiltPages()).includes(page)) {
    throw new Error(`لا يمكن اعتماد الصفحة ${page}: صورها لم تُولَّد بعد`);
  }
  await setPageApproval(page, approved);
  revalidatePath("/admin", "layout");
}

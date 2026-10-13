import { LAUNCH_DATE, localDate, pageForDate, type IsoDate } from "@daydan/core";

export type Gate = { open: true; date: IsoDate; page: number } | { open: false; date: IsoDate; reason: string };

/**
 * Whether a channel may publish today, and which page. Shared by every channel so they all post
 * the same page on the same Mecca date. Before launch only a dry run passes: it rehearses day one (page 1).
 */
export function publishGate(now: Date, config: { enabled: boolean; dryRun: boolean }, killSwitch: string): Gate {
  const date = localDate(now);
  const beforeLaunch = date < LAUNCH_DATE;
  if (!config.enabled) return { open: false, date, reason: `النشر موقوف (${killSwitch})` };
  if (beforeLaunch && !config.dryRun) return { open: false, date, reason: "قبل يوم الإطلاق" };
  return { open: true, date, page: beforeLaunch ? 1 : pageForDate(LAUNCH_DATE, now).page };
}

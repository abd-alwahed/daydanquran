import { useSyncExternalStore } from "react";
import { LAUNCH_DATE, localDate, todaysPage, type IsoDate, type ScheduledPage } from "@daydan/core";

interface Today {
  /** Today's shared page, or null before launch. */
  scheduled: ScheduledPage | null;
  /** The reader's own calendar date, for the reading log. */
  localDate: IsoDate;
}

const subscribe = () => () => {};
let cached: { key: string; value: Today } | undefined;

function compute(): Today {
  const now = new Date();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const key = `${localDate(now)}|${localDate(now, zone)}`;
  // useSyncExternalStore requires a stable snapshot while nothing has changed.
  if (cached?.key !== key) cached = { key, value: { scheduled: todaysPage(LAUNCH_DATE, now), localDate: localDate(now, zone) } };
  return cached.value;
}

/** Today's page in the browser. Null on the server, where "today" is unknown at build time. */
export function useToday(): Today | null {
  return useSyncExternalStore(subscribe, compute, () => null);
}

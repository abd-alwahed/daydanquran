import path from "node:path";
import type { Asset } from "./assets";
import { arabicDay, type Entry } from "./plan";

/** One file in a day's folder: a rendered image, or an image that already exists in the repo. */
export type DayFile = { name: string } & ({ asset: Asset } | { existing: string });

/** "2026-10-17-what-1.png" → "what-1.png": the folder already carries the date. */
export const shortName = (file: string): string => file.replace(/^\d{4}-\d{2}-\d{2}-/, "");

/** The files an entry posts, named as they appear in its day's folder. */
export const entryFiles = (entry: Entry): DayFile[] => [
  ...entry.assets.map((asset) => ({ name: shortName(asset.file), asset })),
  ...(entry.existing ?? []).map((existing) => ({ name: path.basename(existing), existing })),
];

export interface Day {
  date: string;
  files: DayFile[];
  /** caption.txt: the day's post text alone, ready to paste. */
  caption?: string;
  /** notes.txt: the day's schedule (time, kind, title) with each entry's note. */
  notes: string;
}

/** The plan as one folder per posting date. */
export function planDays(plan: Entry[]): Day[] {
  const dates = [...new Set(plan.map((e) => e.date))];
  return dates.map((date) => {
    const entries = plan.filter((e) => e.date === date);
    const captions = entries.flatMap((e) => (e.caption ? [e.caption] : []));
    if (captions.length > 1) throw new Error(`${date}: more than one caption`);
    const files = [...new Map(entries.flatMap(entryFiles).map((f) => [f.name, f])).values()];
    const notes = [
      arabicDay(date),
      ...entries.map((e) =>
        [``, `${e.time} · ${e.kind}: ${e.title}`, ...(e.note ? [e.note] : [])].join("\n"),
      ),
    ].join("\n");
    return { date, files, notes, ...(captions[0] ? { caption: captions[0] } : {}) };
  });
}

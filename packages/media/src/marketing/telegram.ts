import path from "node:path";
import { entryFiles } from "./folders";
import { arabicDay, type Entry } from "./plan";

/** One Telegram message: text, or up to 10 files sent as one album (full quality, no compression). */
export type Outgoing = { text: string } | { files: string[] };

/** Telegram allows at most 10 files in one album. */
const ALBUM_MAX = 10;

/**
 * What the plan's Telegram group receives for one entry: a heading, its images as files, the caption on
 * its own (long-press to copy), then the note. `out` is the rendered plan with one folder per date.
 */
export function entryMessages(entry: Entry, out: string): Outgoing[] {
  const files = entryFiles(entry).map((f) => path.join(out, entry.date, f.name));
  const albums: Outgoing[] = [];
  for (let i = 0; i < files.length; i += ALBUM_MAX) albums.push({ files: files.slice(i, i + ALBUM_MAX) });
  return [
    { text: `${arabicDay(entry.date)} · ${entry.time} · ${entry.kind}\n${entry.title}` },
    ...albums,
    ...(entry.caption ? [{ text: entry.caption }] : []),
    ...(entry.note ? [{ text: `ملاحظة:\n${entry.note}` }] : []),
  ];
}

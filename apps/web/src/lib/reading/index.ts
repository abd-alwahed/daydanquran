import { useSyncExternalStore } from "react";
import { createLocalStorageReadingRepository } from "./local-storage-repository";
import type { ReadingRepository, ReadingState } from "./types";

export type { ReadingRepository, ReadingState } from "./types";

/** The single place that decides where progress is stored. */
export const readingRepository: ReadingRepository = createLocalStorageReadingRepository();

export function useReading(): ReadingState & { markRead: ReadingRepository["markRead"] } {
  const state = useSyncExternalStore(
    readingRepository.subscribe,
    readingRepository.getSnapshot,
    readingRepository.getServerSnapshot,
  );
  return { ...state, markRead: readingRepository.markRead };
}

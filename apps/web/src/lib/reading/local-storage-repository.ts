import type { ReadingRepository, ReadingState } from "./types";

const STORAGE_KEY = "daydan.reading.v1";

interface StoredReading {
  pages: number[];
  log: Record<string, number>;
}

const EMPTY: ReadingState = { pagesRead: new Set(), log: {} };

function read(): ReadingState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const stored = JSON.parse(raw) as StoredReading;
    return { pagesRead: new Set(stored.pages), log: stored.log };
  } catch {
    // Private mode, blocked storage or corrupt data: start empty rather than crash.
    return EMPTY;
  }
}

function write(state: ReadingState): void {
  try {
    const stored: StoredReading = { pages: [...state.pagesRead], log: { ...state.log } };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Progress then lives for this tab only.
  }
}

/** Progress kept in this browser only. */
export function createLocalStorageReadingRepository(): ReadingRepository {
  let snapshot: ReadingState | undefined;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = read();
    emit();
  };

  return {
    getSnapshot: () => (snapshot ??= read()),
    getServerSnapshot: () => EMPTY,
    subscribe(onChange) {
      if (listeners.size === 0) window.addEventListener("storage", onStorage);
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
    markRead(page, { localDate, isTodaysPage }) {
      const current = snapshot ?? read();
      const log = isTodaysPage && !(localDate in current.log) ? { ...current.log, [localDate]: page } : current.log;
      snapshot = { pagesRead: new Set(current.pagesRead).add(page), log };
      write(snapshot);
      emit();
    },
  };
}

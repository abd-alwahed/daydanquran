"use client";

import { useEffect } from "react";

/** Registers public/sw.js in production builds only, so `next dev` is never served stale files. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline support is a bonus; the site works without it.
      });
    }
  }, []);
  return null;
}

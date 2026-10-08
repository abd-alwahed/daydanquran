"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./button.module.css";

type Status = "idle" | "playing" | "paused";

const LABELS: Record<Status, string> = {
  idle: "استمع للتلاوة",
  playing: "إيقاف مؤقت",
  paused: "متابعة التلاوة",
};

/** Plays the page's per-ayah recitation files back to back. */
export function RecitationPlayer({ tracks }: { tracks: readonly string[] }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const index = useRef(0);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    const element = new Audio();
    element.preload = "none";
    element.addEventListener("ended", () => {
      index.current += 1;
      if (index.current < tracks.length) {
        element.src = tracks[index.current]!;
        void element.play();
      } else {
        index.current = 0;
        element.removeAttribute("src");
        setStatus("idle");
      }
    });
    audio.current = element;
    return () => {
      element.pause();
      audio.current = null;
    };
  }, [tracks]);

  function toggle() {
    const element = audio.current;
    if (!element) return;
    if (status === "playing") {
      element.pause();
      setStatus("paused");
      return;
    }
    if (!element.src) element.src = tracks[index.current]!;
    void element.play();
    setStatus("playing");
  }

  return (
    <button type="button" className={styles.button} onClick={toggle} aria-pressed={status === "playing"}>
      {LABELS[status]}
    </button>
  );
}

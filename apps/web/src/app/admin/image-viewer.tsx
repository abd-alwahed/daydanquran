"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toArabicDigits } from "@daydan/core";
import buttons from "@/components/button.module.css";
import styles from "./admin.module.css";

interface Shown {
  src: string;
  alt: string;
}

/**
 * Opens any `img[data-viewable]` inside it at full size, without downloading it.
 * Arrows (or ←/→) move between the images in reading order, Esc closes.
 */
export function ImageViewer({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [images, setImages] = useState<Shown[]>([]);
  const [index, setIndex] = useState<number | null>(null);
  const shown = index === null ? undefined : images[index];

  function open(target: EventTarget) {
    if (!(target instanceof HTMLImageElement) || !target.dataset.viewable) return;
    const all = [...root.current!.querySelectorAll<HTMLImageElement>("img[data-viewable]")];
    setImages(all.map((img) => ({ src: img.getAttribute("src")!, alt: img.alt })));
    setIndex(all.indexOf(target));
    dialog.current!.showModal();
  }

  const move = (step: number) => setIndex((i) => (i === null ? i : (i + step + images.length) % images.length));

  useEffect(() => {
    if (index === null) return;
    // RTL: the next image is to the left.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") move(1);
      if (e.key === "ArrowRight") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div ref={root} onClick={(e) => open(e.target)}>
      {children}
      <dialog ref={dialog} className={styles.viewer} onClose={() => setIndex(null)} aria-label="عرض الصورة">
        {shown && (
          <>
            <div className={styles.viewerBar}>
              <strong>{shown.alt}</strong>
              <span>
                {toArabicDigits(index! + 1)} من {toArabicDigits(images.length)}
              </span>
              {images.length > 1 && (
                <>
                  <button type="button" className={buttons.button} onClick={() => move(-1)}>
                    السابقة
                  </button>
                  <button type="button" className={buttons.button} onClick={() => move(1)}>
                    التالية
                  </button>
                </>
              )}
              <a className={buttons.button} href={shown.src} download>
                تنزيل
              </a>
              <button type="button" className={buttons.primary} onClick={() => dialog.current!.close()}>
                إغلاق
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- the exact rendered file, unscaled by Next */}
            <img src={shown.src} alt={shown.alt} />
          </>
        )}
      </dialog>
    </div>
  );
}

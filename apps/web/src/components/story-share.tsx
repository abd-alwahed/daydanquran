"use client";

import { useState } from "react";
import { SITE_URL } from "@daydan/core";
import { useToday } from "@/lib/use-today";
import buttons from "./button.module.css";
import styles from "./story-share.module.css";

/**
 * Shares the page's story image (1080×1920) through the phone's share sheet, where Instagram and
 * Facebook offer "Story". Where sharing files is not supported (most desktops), the image is downloaded.
 */
export function StoryShare({ page }: { page: number }) {
  const today = useToday();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(`/p/${page}/ig-story.jpg`);
      if (!response.ok) throw new Error(String(response.status));
      const file = new File([await response.blob()], `daydan-${page}.jpg`, { type: "image/jpeg" });
      // Message library (docs/01-product.md): the share card invites to read, it never announces progress.
      const invite = today?.scheduled?.page === page ? "اقرأ معي صفحة اليوم" : "اقرأ معي هذه الصفحة";
      const text = `${invite}: ${SITE_URL}/p/${page}/`;

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      const url = URL.createObjectURL(file);
      const link = Object.assign(document.createElement("a"), { href: url, download: file.name });
      link.click();
      // Revoked later: some browsers cancel a download whose URL is revoked at once.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus("حُفظت الصورة، انشرها من هاتفك في الستوري.");
    } catch (error) {
      // Closing the share sheet is not an error.
      if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("تعذّر تجهيز الصورة، حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.share}>
      <button type="button" className={buttons.button} onClick={share} disabled={busy}>
        شارك الصفحة في الستوري
      </button>
      <p className={styles.status} role="status">
        {status}
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import buttons from "@/components/button.module.css";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className={buttons.primary} onClick={copy}>
      {copied ? "نُسخ النص" : "انسخ نص واتساب"}
    </button>
  );
}

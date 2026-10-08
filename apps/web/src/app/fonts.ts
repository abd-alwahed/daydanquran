import { El_Messiri, Scheherazade_New, Tajawal } from "next/font/google";

// Self-hosted at build time by next/font: no request to Google from the reader's browser.
export const display = El_Messiri({ subsets: ["arabic"], weight: ["500", "700"], variable: "--font-display" });
export const reading = Scheherazade_New({ subsets: ["arabic"], weight: ["400", "600"], variable: "--font-reading" });
export const ui = Tajawal({ subsets: ["arabic"], weight: ["400", "500", "700"], variable: "--font-ui" });

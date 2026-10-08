# برومبتات Claude Code (مرحلة بمرحلة)

**طريقة الاستخدام:** ضع مجلد `daydan-handoff` كاملاً داخل مستودع المشروع (مثلاً في `/handoff`) وانسخ `CLAUDE.md` إلى جذر المستودع. ثم أعطِ Claude Code برومبت مرحلة واحدة في كل جلسة، وراجع النتيجة قبل الانتقال للتالية. البرومبتات بالإنجليزية لأنها أدق في التعليمات التقنية؛ الواجهة نفسها عربية.

---

## 0 · Kickoff (أول جلسة)
```
Read CLAUDE.md and every file in handoff/docs/ first. Then summarize back to me, in Arabic, in 10 bullet points: the product, the non-negotiables, the stack, and the phase plan. List anything that is ambiguous or contradictory before writing any code. Do not write code in this session.
```

## 1 · Foundation
```
Phase 0 (handoff/docs/08-roadmap.md). Scaffold the monorepo exactly as in handoff/docs/03-architecture.md: pnpm + Turborepo, TypeScript strict, ESLint/Prettier, Vitest, GitHub Actions CI (lint, typecheck, test).
Create packages/core with pageForDate(launchDate, now, tz='Asia/Riyadh') ported from handoff/reference-code/schedule.mjs, plus constants (TOTAL_PAGES=604, TOTAL_AYAHS=6236).
Tests: local-midnight boundary in Asia/Riyadh, day 604 → page 604, day 605 → page 1 khatma 2, every page hit exactly once per khatma, dates before launch throw.
Add .env.example (no real secrets) and a README in Arabic explaining how to run everything.
Stop when CI is green and show me the test output.
```

## 2 · Content data
```
Phase 1. In packages/content build the fetcher from handoff/reference-code/fetch-pages.mjs (Quran.com API v4). Resolve the Husary murattal recitation id and the Tafsir Muyassar id BY NAME and fail loudly if the match is not unique. Cache raw API responses on disk so re-runs don't hit the API.
Add validators per handoff/docs/04-content-pipeline.md step 2: 6236 ayahs, pages contiguous 1..604, each ayah on exactly one page, Uthmani text equals Tanzil text byte-for-byte after NFC normalization (download Tanzil Uthmani text and keep its license notice), non-empty tafsir per ayah, audio URL per ayah.
Output content/build/pages/<n>.json and content/build/report.json (counts, longest tafsir per page in characters, any validation failures).
NEVER modify, trim, or "clean" Quran text or tafsir text beyond stripping HTML tags from tafsir. Show me report.json.
```

## 3 · Media
```
Phase 2. In packages/media:
(a) Audio: for each page, download per-ayah Husary MP3s and concatenate in order with ffmpeg into recitation.mp3 (mono). Record real duration per page in report.json.
(b) Cards: render handoff/templates-html/*.html with Playwright (Chromium) at their exact pixel sizes, replacing every [placeholder] from page data. Use Arabic-Indic digits. Tafsir cards: split text across cards only at sentence boundaries, never mid-word; card counter like "١ / ٣". Load the Google Fonts and wait for document.fonts.ready before screenshot; fail if fonts did not load.
(c) Mushaf page image: use the official King Fahd Complex digital mushaf images (handoff/docs/07-licenses.md). Never draw anything on top of it.
(d) Facebook page video (image + audio) and a ≤90s 9:16 reel clip.
Build pages 1–5 first and send me the outputs to review before running all 604. Then write content/v1/<page>/ per docs/04 and a manifest.json with sha256 per file. Upload to R2 behind a flag.
```

## 4 · Admin review
```
Phase 3. In apps/web add /admin (protected by Supabase auth + an allowlist of admin emails). For each page show every generated asset (mushaf, post, tafsir cards, story, reminder, audio player, caption) and an "Approve" button stored in DB. Today's page view also shows a ready-to-copy WhatsApp text + image download. Unapproved pages must be impossible to publish.
```

## 5 · Web app (PWA)
```
Phase 4. Build apps/web as an Arabic RTL Next.js PWA deployed to Cloudflare Pages at daydanquran.pages.dev, using handoff/brand/tokens.css and the fonts in docs/06-brand.md. Match the app screen in handoff/templates-preview (Screens) and the brand rules.
Screens: Today (mushaf image, play recitation, tafsir, "قرأت ورد اليوم" button, khatma progress of 30 juz bars, week bars), Make-up list (اقضِ ما فاتك), Settings (reminder time or after-prayer + city, evening nudge, primary channel, Ramadan message), About (name meaning + sources text from docs/07).
Anonymous Supabase user by default; upgrading to email/Google keeps progress. reading_log unique per (user, local_date). Web push notifications. Lighthouse PWA + accessibility ≥ 90. Copy strictly from the message library in docs/06-brand.md.
```

## 6 · Telegram
```
Phase 5. apps/bot as a Cloudflare Worker webhook (grammY or plain Bot API). /start with optional link token → links telegram identity to the user. Inline "قرأت ✅" button writes reading_log. /reminder to set time. apps/publisher daily cron at 04:00 UTC: post to @daydanquran: album (mushaf + tafsir cards), then recitation audio, then caption with the read button. Idempotent via publications(channel, publish_date). PUBLISH_DRY_RUN and kill switch. Retry 3x with backoff, then alert ADMIN_CHAT_ID.
```

## 7 · Reminders
```
Phase 6. Cron every 15 minutes: select users whose reminder is due in their own timezone (fixed time, or after the chosen prayer computed with adhan-js from their city) and who have no reading_log for their local date; send on their primary channel only. Evening nudge once. After 7 days without reading → weekly; after 30 days → stop, except one Ramadan-start message if enabled. Re-check reading status at send time. Unit-test all rules with a fake clock.
```

## 8 · Meta
```
Phase 7. packages/publishers/instagram.ts and facebook.ts via the Graph API: Instagram carousel (mushaf + tafsir cards, respect the max items limit), story at 17:00 UTC, reels 3x/week (≤90s, 9:16, poll container status until FINISHED). Query content_publishing_limit before posting; never hardcode it. Facebook: same carousel + full page video. Write the Meta App Review checklist (permissions, screencast script, privacy policy page on the site).
```

## Review prompt (after any phase)
```
Review the changes of this phase against CLAUDE.md non-negotiables and docs/02-decisions.md. List violations, missing tests, and anything that could publish wrong Quran text or double-post. Fix them, then show me a short summary in Arabic.
```

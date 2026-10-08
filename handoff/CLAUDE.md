# Daydan · دَيْدَن — project context for Claude Code

> «اجعل القرآن دَيْدَنك» — one page of the Quran every day, with Tafsir Muyassar and recitation, across every platform.

Non-profit da'wah project. Owner: Mohamad AbdAlwahed (frontend engineer: React, Next.js, TypeScript, React Native). UI language: Arabic (RTL). Read every file in `docs/` before writing code; `docs/02-decisions.md` is binding.

## Non-negotiables (never break these)
1. **Quranic text, page images and tafsir are never generated, paraphrased, OCR'd, or "fixed" by code or AI.** They come only from the sources in `docs/04-content-pipeline.md`, byte-for-byte, and are verified (6,236 ayahs; text matches Tanzil exactly; every ayah has tafsir).
2. **Everything is prepared ahead of time.** A one-off pipeline builds all 604 pages' assets, they are reviewed, then frozen as a versioned release (`content/v1`). The daily job only *publishes* frozen files. It never builds content at publish time.
3. **Idempotent publishing.** Unique `(channel, date)` in `publications`. Re-running a job must never double-post.
4. **Reading log is unique per `(user_id, local_date)`.** Pressing "قرأت" on two platforms counts once.
5. No streak-shaming, no leaderboards, no badges, no red/alarm colors, no "you missed X pages" copy. Tone rules: `docs/06-brand.md`.
6. Nothing is ever drawn on top of a mushaf page image (no logo, no text, no crop, no recolor).
7. Arabic-Indic digits (٢٤٥) in Arabic UI copy; the name is always written with diacritics: «دَيْدَن».

## The daily schedule (core logic)
- Everyone reads the **same page** on the same day. Launch day = page 1; page = `(daysSince(launch) % 604) + 1`, computed in **Asia/Riyadh (UTC+3)** for global/public channels. Reference implementation + tests: `reference-code/schedule.mjs`.
- Each user also has a **personal khatma** (pages they actually read, of 604) and an optional "اقضِ ما فاتك" list. Missed pages are never shown as debt.
- Public post: **07:00 Asia/Riyadh (04:00 UTC)**. Evening reminder story / unread nudge: **20:00 Asia/Riyadh (17:00 UTC)**. Per-user reminders use the user's own timezone.

## Stack (decided)
- Monorepo: pnpm + Turborepo, TypeScript everywhere.
- `apps/web`: Next.js PWA, deployed to **Cloudflare Pages** on the free domain **`daydanquran.pages.dev`** (custom domain `daydanquran.com` later, no code change).
- `apps/bot`: Telegram bot (webhook) on a Cloudflare Worker.
- `apps/publisher`: Cloudflare Worker with Cron Triggers (daily publish + reminder sweep every 15 min).
- `packages/core` (schedule, types), `packages/content` (pipeline, validators), `packages/media` (image/audio generation), `packages/publishers` (one adapter per channel).
- DB/Auth: **Supabase** (Postgres + Auth with anonymous users + identity linking).
- Media storage: **Cloudflare R2** (no egress fees).
- Image generation: render `templates-html/*.html` with Playwright (Chromium) at exact pixel sizes; fill placeholders `[...]` from data.
- Audio: concatenate per-ayah Husary murattal MP3s into one file per page with ffmpeg.

## Brand (short)
Colors: primary `#2E6475`, text `#1F3A44`, paper `#F6F3EC`, rain `#7FB3C2` (decoration only), gold `#B8924A` (= "today" only). Fonts: El Messiri (display), Scheherazade New (reading/tafsir), Tajawal (UI). Tokens: `brand/tokens.css`, `brand/tokens.json`. Logo files: `brand/svg`, `brand/png`. Full rules: `docs/06-brand.md`. Image rendering uses the local fonts in `brand/fonts/` (never Google Fonts in Playwright) and must pass `reference-code/fontcheck.py` with zero fallback glyphs.

## Working rules
- Small PRs per phase (see `prompts/claude-code-prompts.md`). Write tests for: schedule math (timezone edges, 604 wraparound), content validators, idempotency, reading-log uniqueness.
- Secrets only via env (`.env.example` committed, never real tokens). Telegram token, Supabase keys, Meta tokens, R2 keys.
- Dry-run mode for every publisher (`PUBLISH_DRY_RUN=1`) and a per-channel kill switch.
- On publish failure: retry with backoff, then alert the admin Telegram chat.
- When unsure about a religious/content question: stop and ask the owner. Never guess.

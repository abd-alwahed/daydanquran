import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import type { NextConfig } from "next";

export default function config(phase: string): NextConfig {
  const dev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    // Fully static site for Cloudflare Pages: every page is rendered at build time.
    // The dev server is not exported so the local review screen (/admin) can save approvals.
    output: dev ? undefined : "export",
    // Files named page.dev.tsx exist only in `next dev`: /admin is never part of a build,
    // so the deployed site has no review screen and nothing on it can approve a page.
    pageExtensions: dev ? ["dev.tsx", "dev.ts", "tsx", "ts"] : ["tsx", "ts"],
    trailingSlash: true,
    images: { unoptimized: true },
    transpilePackages: ["@daydan/core"],
    reactStrictMode: true,
    // Linting runs once for the whole repo (`pnpm lint`), not again inside `next build`.
    eslint: { ignoreDuringBuilds: true },
  };
}

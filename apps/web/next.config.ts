import type { NextConfig } from "next";

const config: NextConfig = {
  // Fully static site for Cloudflare Pages: every page is rendered at build time.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@daydan/core"],
  reactStrictMode: true,
  // Linting runs once for the whole repo (`pnpm lint`), not again inside `next build`.
  eslint: { ignoreDuringBuilds: true },
};

export default config;

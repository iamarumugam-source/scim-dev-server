import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server in .next/standalone — required for the
  // Docker multi-stage build. Vercel ignores this, so it is safe to keep.
  output: "standalone",

  eslint: {
    // Lint warnings must never fail a deploy — run `npm run lint` separately.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Pre-existing: allow builds to succeed even if type errors exist.
    ignoreBuildErrors: true,
  },
  logging: {
    fetches: {
      hmrRefreshes: true,
    },
  },
};

export default nextConfig;

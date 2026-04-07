import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server in .next/standalone — required for Docker.
  output: "standalone",

  eslint: {
    ignoreDuringBuilds: true,
  },
  logging: {
    fetches: {
      hmrRefreshes: true,
    },
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
module.exports = {
  // Produces .next/standalone — required for the Docker multi-stage build.
  output: "standalone",

  typescript: {
    // Pre-existing: allow builds to succeed even if type errors exist.
    ignoreBuildErrors: true,
  },
};

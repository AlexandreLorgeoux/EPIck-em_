import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const repoRoot = path.join(__dirname, "../../");

// Shares the repo-root .env with the API (AUTH_SECRET, API_URL), as Next.js
// only reads apps/web/.env by itself. In Docker the variables are injected
// and no .env file exists, so this does nothing there.
loadEnvConfig(repoRoot);

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  cacheComponents: true,
  partialPrefetching: true,
  // The browser calls /api/... on the site itself and Next.js forwards it to
  // the API, so the session cookies stay first-party and no CORS is needed.
  // Read at build time: the Docker image sets API_URL as a build argument.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL ?? "http://localhost:4000"}/:path*`,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

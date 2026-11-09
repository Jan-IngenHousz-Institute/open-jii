import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

import { env } from "./env";

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@repo/i18n", "@repo/monitoring", "@repo/ui"],
};

// A static export cannot rewrite, so only the dev server proxies the publisher's data file, and
// only a build exports.
export default function nextConfig(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      ...config,
      rewrites: () =>
        Promise.resolve([
          { source: "/data/:path*", destination: `${env.STATUS_DATA_ORIGIN}/data/:path*` },
        ]),
    };
  }

  return { ...config, output: "export" };
}

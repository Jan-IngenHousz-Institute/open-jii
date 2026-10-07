import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true",
  transpilePackages: [
    "@repo/api",
    "@repo/auth",
    "@repo/iot",
    "@repo/ui",
    "@repo/cms",
    "@repo/analytics",
  ],

  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../../"),
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.ctfassets.net",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,

  // Externalize posthog-node for server-side only
  serverExternalPackages: ["posthog-node"],

  // For PostHog error tracking; the deploy uploads them and removes them before publishing assets.
  productionBrowserSourceMaps: true,

  experimental: {
    // The deploy build prerenders the public pages from Contentful. Three attempts with backoff ride
    // out a rate-limited burst or a stray 5xx; an outage still fails the build.
    staticGenerationRetryCount: 3,
  },
};

export default nextConfig;

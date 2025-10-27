import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true",
  transpilePackages: ["@repo/api", "@repo/auth", "@repo/database", "@repo/ui", "@repo/cms"],

  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../../"),
  images: {
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
      {
        source: "/:locale/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/:locale/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,

  webpack: (config, { isServer, webpack }) => {
    if (isServer) {
      // Don't bundle posthog-js on the server - it's client-only
      config.externals = [...(config.externals || []), "posthog-js"];
    } else {
      // For client-side, provide fallbacks for Node.js modules that posthog-js references
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };

      // Handle node: protocol imports by replacing them with empty modules
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
    }
    return config;
  },
};

export default nextConfig;

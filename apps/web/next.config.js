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
};

export default nextConfig;

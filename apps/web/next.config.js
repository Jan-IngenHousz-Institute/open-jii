/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true",
  transpilePackages: ["@repo/api", "@repo/auth", "@repo/database", "@repo/ui"],
};

export default nextConfig;

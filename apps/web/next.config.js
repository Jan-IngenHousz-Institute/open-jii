/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui"],
  devIndicators: process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true",
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/api", "@repo/auth", "@repo/database", "@repo/ui"],
};

export default nextConfig;

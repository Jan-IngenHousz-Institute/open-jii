/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/api", "@repo/auth", "@repo/database", "@repo/ui"],
  /** We already do linting and typechecking as separate tasks in CI */
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

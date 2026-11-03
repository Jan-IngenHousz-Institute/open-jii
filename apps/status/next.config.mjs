/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@repo/i18n", "@repo/monitoring", "@repo/ui"],
};

export default config;

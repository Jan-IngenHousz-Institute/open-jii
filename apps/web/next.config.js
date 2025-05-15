/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: async () => [
    {
      // matching all API routes
      source: "/",
      headers: [
        { key: "Access-Control-Allow-Credentials", value: "true" },
        { key: "Access-Control-Allow-Origin", value: "http://localhost:3020" }, // replace this your actual origin
        {
          key: "Access-Control-Allow-Methods",
          value: "GET,DELETE,PATCH,POST,PUT,OPTIONS",
        },
        {
          key: "Access-Control-Allow-Headers",
          value:
            "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
        },
      ],
    },
  ],
  transpilePackages: ["@repo/api", "@repo/auth", "@repo/database", "@repo/ui"],
};

export default nextConfig;

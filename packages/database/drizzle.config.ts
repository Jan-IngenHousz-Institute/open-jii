import type { Config } from "drizzle-kit";

// Import from our local env file instead of directly from @repo/env
import { env } from "./src/env";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",

  dbCredentials: {
    host: env.server.POSTGRES_HOST,
    port: env.server.POSTGRES_PORT,
    database: env.server.POSTGRES_DB,
    user: env.server.POSTGRES_USER,
    password: env.server.POSTGRES_PASSWORD,
    ssl: false,
  },
} satisfies Config;

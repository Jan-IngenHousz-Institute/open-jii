import type { Config } from "drizzle-kit";

import { env } from "@repo/env";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",

  dbCredentials: {
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    ssl: false,
  },
} satisfies Config;

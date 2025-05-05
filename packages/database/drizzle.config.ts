import "dotenv/config";
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",

  dbCredentials: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: process.env.POSTGRES_PORT
      ? parseInt(process.env.POSTGRES_PORT)
      : 5432,
    database: process.env.POSTGRES_DB || "openjii_local",
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    ssl: false,
  },
} satisfies Config;

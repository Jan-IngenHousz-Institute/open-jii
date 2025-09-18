import "dotenv/config";
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: process.env.DATABASE_URL
    ? {
        url: process.env.DATABASE_URL,
        ssl: !process.env.DATABASE_URL.includes("localhost"),
      }
    : {
        url: `postgres://postgres:postgres@localhost:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "openjii_local"}`,
        ssl: false,
      },
} satisfies Config;

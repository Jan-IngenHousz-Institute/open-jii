import "dotenv/config";
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: process.env.DATABASE_URL
    ? {
        url: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/openjii_local",
        ssl: !process.env.DATABASE_URL.includes("localhost"),
      }
    : {
        url: "postgres://postgres:postgres@localhost:5432/openjii_local",
        ssl: false,
      },
} satisfies Config;

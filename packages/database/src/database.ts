import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as baseSchema from "./schema";

const getEnvVariable = (name: string) => {
  const value = process.env[name];
  if (value == null) throw new Error(`environment variable ${name} not found`);
  return value;
};

export const client = postgres(getEnvVariable("DATABASE_URL"));

export const db = (...schemas: Record<string, unknown>[]) => {
  // Merge all schemas together
  const mergedSchema = schemas.reduce(
    (result, currentSchema) => {
      return { ...result, ...currentSchema };
    },
    { ...baseSchema },
  );

  return drizzle({ client, schema: mergedSchema });
};

export type DatabaseInstance = ReturnType<typeof db>;

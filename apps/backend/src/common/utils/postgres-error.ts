import { z } from "zod";

export const FOREIGN_KEY_VIOLATION = "23503";
export const LOCK_NOT_AVAILABLE = "55P03";

/** The SQLSTATE of a Postgres error Drizzle wrapped, if it is one. */
export function postgresErrorCode(error: unknown): string | undefined {
  const parsed = z.object({ cause: z.object({ code: z.string() }) }).safeParse(error);
  return parsed.success ? parsed.data.cause.code : undefined;
}

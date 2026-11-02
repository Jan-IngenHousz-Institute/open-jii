import { ORPCError } from "@orpc/client";
import { z } from "zod";

const questionTypeConflict = z.object({ code: z.literal("QUESTION_TYPE_CHANGE") });

export function workbookPinError(error: unknown, fallback: string, conflict: string): string {
  if (!(error instanceof ORPCError) || error.status !== 400) return fallback;
  return questionTypeConflict.safeParse(error.data).success ? conflict : error.message;
}

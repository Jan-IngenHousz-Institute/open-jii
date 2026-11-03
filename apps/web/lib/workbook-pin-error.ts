import { ORPCError } from "@orpc/client";
import { z } from "zod";

const questionConflict = z.object({
  code: z.enum(["QUESTION_TYPE_CHANGE", "DUPLICATE_QUESTION_KEY"]),
});

export function workbookPinError(
  error: unknown,
  fallback: string,
  conflict: string,
  duplicate: string,
): string {
  if (!(error instanceof ORPCError) || error.status !== 400) return fallback;
  const parsed = questionConflict.safeParse(error.data);
  if (!parsed.success) return error.message;
  return parsed.data.code === "QUESTION_TYPE_CHANGE" ? conflict : duplicate;
}

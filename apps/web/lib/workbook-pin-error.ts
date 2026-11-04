import { ORPCError } from "@orpc/client";
import { parseApiError } from "~/util/apiError";

export function workbookPinError(
  error: unknown,
  fallback: string,
  conflict: string,
  duplicate: string,
): string {
  if (!(error instanceof ORPCError) || error.status !== 400) return fallback;
  const code = parseApiError(error)?.code;
  if (code === "QUESTION_TYPE_CHANGE") return conflict;
  if (code === "DUPLICATE_QUESTION_KEY") return duplicate;
  return fallback;
}

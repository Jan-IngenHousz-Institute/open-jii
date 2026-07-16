import { ORPCError } from "@orpc/client";
import z from "zod";

const apiError = z.object({
  code: z.string().optional(),
  message: z.string(),
});

const orpcData = z.object({
  code: z.string().optional(),
});

function hasBody(value: unknown): value is { body: unknown } {
  return typeof value === "object" && value !== null && "body" in value;
}

/**
 * Normalizes a thrown API error into `{ message, code? }`.
 *
 * oRPC's OpenAPILink surfaces errors two ways:
 * - A proper oRPC error carries the user message at `.message` and the app code
 *   at `.data.code` (the top-level `.code` is the HTTP-semantic oRPC code).
 * - A non-oRPC-envelope response (the better-auth guard's 401, a proxy/gateway 5xx)
 *   is wrapped under `.data.body` with a generic `.message`, so the real payload
 *   lives there. A body without a `message` is opaque; return undefined so the
 *   caller shows its own fallback.
 *
 * The native upload endpoint throws a plain error carrying `{ body: { message, code } }`.
 */
export function parseApiError(error: unknown): { code?: string; message: string } | undefined {
  if (error instanceof ORPCError) {
    if (hasBody(error.data)) {
      const wrapped = apiError.safeParse(error.data.body);
      return wrapped.success ? wrapped.data : undefined;
    }
    const data = orpcData.safeParse(error.data);
    return { message: error.message, code: data.success ? data.data.code : undefined };
  }

  if (typeof error === "object" && error !== null && "body" in error) {
    const result = apiError.safeParse(error.body);
    if (result.success) return result.data;
  }

  return undefined;
}

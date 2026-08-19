/**
 * Better Auth's client never throws: it resolves to `{ data, error }`. React Query
 * needs a rejection to enter its error state, and the organization screens surface
 * server refusals verbatim (the personal-workspace shields, the last-owner rules,
 * the "still owns N resources" delete block) — so the envelope is unwrapped once,
 * here, and the message travels as a real Error.
 */

/** The shape of Better Auth's client envelope, narrowed to what is consumed. */
export interface AuthClientEnvelope<T> {
  data: T;
  error: { message?: string | null; code?: string | null; status?: number } | null;
}

/** A refused Better Auth write. `code` is the plugin's error code, when it sent one. */
export class AuthClientError extends Error {
  readonly code: string | undefined;
  readonly status: number | undefined;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "AuthClientError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Reject with the server's own message when there is one; the caller's fallback
 * covers the case where Better Auth reports a bare status.
 */
export function unwrapAuthResult<T>(envelope: AuthClientEnvelope<T>): T {
  if (envelope.error) {
    throw new AuthClientError(
      envelope.error.message ?? "",
      envelope.error.code ?? undefined,
      envelope.error.status,
    );
  }
  return envelope.data;
}

/** The refusal message to show, or `undefined` when only a fallback will do. */
export function authErrorMessage(error: unknown): string | undefined {
  if (error instanceof AuthClientError && error.message.length > 0) return error.message;
  if (error instanceof Error && error.message.length > 0) return error.message;
  return undefined;
}

/**
 * Whether an oRPC client error carries one of the given HTTP statuses. Retry
 * predicates and the screens' "this is an answer, not a failure" branches read
 * the same helper so they can never disagree about what a definitive refusal is.
 */
export function isApiStatus(error: unknown, ...statuses: number[]): boolean {
  if (typeof error !== "object" || error === null || !("status" in error)) return false;
  const { status } = error;
  return typeof status === "number" && statuses.includes(status);
}

/** The backend's own error code, which it sends on `data.code` alongside the status. */
export function apiErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("data" in error)) return undefined;
  const { data } = error;
  if (typeof data !== "object" || data === null || !("code" in data)) return undefined;
  const { code } = data;
  return typeof code === "string" ? code : undefined;
}

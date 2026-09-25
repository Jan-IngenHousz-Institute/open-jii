/**
 * Custom retry function for React Query hooks.
 * Skips retries for 4xx client errors (not transient) and for 504 timeouts, retries up to 3
 * times for other errors.
 *
 * A 504 means the backend or the edge already waited out its limit, so a retry queues the
 * same slow statement again behind everyone else's.
 *
 * @param failureCount - Number of times the query has failed
 * @param error - The error that occurred
 * @returns Whether to retry the query
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number") {
    const isClientError = error.status >= 400 && error.status < 500;
    const isTimeout = error.status === 504;
    if (isClientError || isTimeout) {
      return false;
    }
  }

  // Use default retry logic for other errors (up to 3 times)
  return failureCount < 3;
}

/**
 * Custom retry function for React Query hooks.
 * Skips retries for 4xx client errors (not transient), retries up to 3 times for other errors.
 *
 * @param failureCount - Number of times the query has failed
 * @param error - The error that occurred
 * @returns Whether to retry the query
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  // Don't retry on 4xx client errors - these are not transient
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return false;
  }

  // Use default retry logic for other errors (up to 3 times)
  return failureCount < 3;
}

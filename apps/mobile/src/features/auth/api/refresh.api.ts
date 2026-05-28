import { getAuthClient } from "~/features/auth/services/auth";

let refreshInFlight: Promise<boolean> | null = null;
let refreshController: AbortController | null = null;

// Bounded so an offline `getSession` can't keep the fetcher stuck on a 401
// retry beyond the per-request fetch budget.
const REFRESH_TIMEOUT_MS = 8_000;

/**
 * Single-flight session re-validation.
 *
 * Forces a server-side session check (disables Better Auth's cookie cache),
 * which slides the cookie expiry forward when the session is still valid.
 * Returns true if the session is now valid, false otherwise.
 *
 * Concurrent callers share one in-flight refresh — this is the
 * single-flight lock that prevents the OJD-1515 burst class where N
 * parallel requests on a stale session each tried to refresh
 * independently.
 *
 * Each caller is bounded by REFRESH_TIMEOUT_MS via Promise.race; the
 * timeout also aborts the shared upstream fetch through fetchOptions.signal
 * so the underlying request actually stops, and refreshInFlight stays tied
 * to that upstream call (not the race) so concurrent callers always dedupe.
 */
export async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    const authClient = getAuthClient();
    refreshController = new AbortController();
    refreshInFlight = authClient
      .getSession({
        query: { disableCookieCache: true },
        fetchOptions: { signal: refreshController.signal },
      })
      .then((res) => !!res?.data?.session)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
        refreshController = null;
      });
  }

  const upstream = refreshInFlight;
  return Promise.race([
    upstream,
    new Promise<boolean>((resolve) =>
      setTimeout(() => {
        refreshController?.abort();
        resolve(false);
      }, REFRESH_TIMEOUT_MS),
    ),
  ]);
}

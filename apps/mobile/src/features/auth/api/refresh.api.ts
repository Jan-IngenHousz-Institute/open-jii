import { getAuthClient } from "~/features/auth/services/auth";

let refreshInFlight: Promise<boolean> | null = null;

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
 */
export async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const authClient = getAuthClient();
      const data = await Promise.race([
        authClient.getSession({ query: { disableCookieCache: true } }).then((res) => res.data),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("refreshSession timed out")), REFRESH_TIMEOUT_MS),
        ),
      ]);
      return !!data?.session;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

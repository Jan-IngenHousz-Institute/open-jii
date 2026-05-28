import { getAuthClient } from "~/features/auth/services/auth";

let refreshInFlight: Promise<boolean> | null = null;

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
      const { data } = await authClient.getSession({
        query: { disableCookieCache: true },
      });
      return !!data?.session;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

import { getAuthClient } from "~/features/auth/services/auth";
import { getSessionToken } from "~/shared/api/session-cookie";

interface InFlightRefresh {
  upstream: Promise<boolean>;
  controller: AbortController;
}

// Keyed by the session token current when the refresh starts, so a caller only
// shares a validation of its own session, never one begun for an older sign-in.
const refreshesInFlight = new Map<string, InFlightRefresh>();

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
 * Concurrent callers on the same session token share one in-flight refresh —
 * this is the single-flight lock that prevents the OJD-1515 burst class where N
 * parallel requests on a stale session each tried to refresh
 * independently.
 *
 * Each caller is bounded by REFRESH_TIMEOUT_MS via Promise.race; the
 * timeout also aborts the shared upstream fetch through fetchOptions.signal
 * so the underlying request actually stops, and the in-flight entry stays tied
 * to that upstream call (not the race) so concurrent callers always dedupe.
 */
export async function refreshSession(): Promise<boolean> {
  const authClient = getAuthClient();
  const token = getSessionToken(authClient.getCookie()) ?? "";
  let refresh = refreshesInFlight.get(token);
  if (!refresh) {
    const controller = new AbortController();
    const upstream = authClient
      .getSession({
        query: { disableCookieCache: true },
        fetchOptions: { signal: controller.signal },
      })
      .then((res) => !!res?.data?.session)
      .catch(() => false)
      .finally(() => {
        refreshesInFlight.delete(token);
      });
    refresh = { upstream, controller };
    refreshesInFlight.set(token, refresh);
  }

  const { upstream, controller } = refresh;
  return Promise.race([
    upstream,
    new Promise<boolean>((resolve) =>
      setTimeout(() => {
        controller.abort();
        resolve(false);
      }, REFRESH_TIMEOUT_MS),
    ),
  ]);
}

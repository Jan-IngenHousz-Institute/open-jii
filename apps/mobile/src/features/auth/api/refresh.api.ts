import { getAuthClient } from "~/features/auth/services/auth";
import { getSessionToken } from "~/shared/api/session-cookie";

interface InFlightRefresh {
  upstream: Promise<boolean>;
  controller: AbortController;
}

// Keyed by the session token current when the refresh starts, so a caller only
// shares a validation of its own session, never one begun for an older sign-in.
const refreshesInFlight = new Map<string, InFlightRefresh>();

// A late settle or timeout must not evict a newer refresh for the same token.
function release(token: string, entry: InFlightRefresh) {
  if (refreshesInFlight.get(token) === entry) refreshesInFlight.delete(token);
}

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
 * Each caller is bounded by REFRESH_TIMEOUT_MS via Promise.race, from before
 * the session cookie is read; the timeout also aborts the shared upstream fetch
 * through fetchOptions.signal so the underlying request actually stops. The
 * in-flight entry is released
 * when its upstream settles or a caller's timeout fires, whichever comes
 * first, so an upstream that ignores the abort cannot block later refreshes.
 */
export async function refreshSession(): Promise<boolean> {
  const authClient = getAuthClient();
  let expired = false;
  let joined: { token: string; entry: InFlightRefresh } | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timeoutId = setTimeout(() => {
      expired = true;
      if (joined) {
        joined.entry.controller.abort();
        // An upstream that ignores the abort must not hold the token's slot forever.
        release(joined.token, joined.entry);
      }
      resolve(false);
    }, REFRESH_TIMEOUT_MS);
  });

  const refresh = authClient.getCookie().then((cookie) => {
    // A cookie read that outlived the deadline must not start a refresh nobody awaits.
    if (expired) return false;

    const token = getSessionToken(cookie) ?? "";
    let entry = refreshesInFlight.get(token);
    if (!entry) {
      const controller = new AbortController();
      const created: InFlightRefresh = {
        controller,
        upstream: authClient
          .getSession({
            query: { disableCookieCache: true },
            fetchOptions: { signal: controller.signal },
          })
          .then((res) => !!res?.data?.session)
          .catch(() => false)
          .finally(() => release(token, created)),
      };
      entry = created;
      refreshesInFlight.set(token, entry);
    }

    joined = { token, entry };
    return entry.upstream;
  });

  return Promise.race([refresh, timeout]).finally(() => clearTimeout(timeoutId));
}

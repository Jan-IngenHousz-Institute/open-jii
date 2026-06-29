import { refreshSession } from "~/features/auth/api/refresh.api";
import { getAuthClient } from "~/features/auth/services/auth";

// Without this, fetch hangs at the platform default whenever the backend is
// unreachable (Wi-Fi-without-internet, captive portal, sleeping device). 10s is
// generous for any real call and fails fast otherwise.
export const FETCH_TIMEOUT_MS = 10_000;

// oRPC builds the Request; this wrapper mirrors the previous ts-rest fetcher:
// inject the session cookie, enforce a 10s timeout, forward upstream aborts
// (React Query unmount), and retry once after a single-flight session refresh
// on 401.
export async function orpcFetch(
  request: Request,
  init: RequestInit | undefined,
): Promise<Response> {
  const authClient = getAuthClient();

  const send = () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const upstream = init?.signal ?? request.signal;
    if (upstream) {
      if (upstream.aborted) controller.abort();
      else upstream.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const headers = new Headers(request.headers);
    const cookie = authClient.getCookie();
    if (cookie) {
      headers.set("Cookie", cookie);
    }

    return fetch(request.clone(), { signal: controller.signal, headers }).finally(() =>
      clearTimeout(timeoutId),
    );
  };

  let result = await send();

  // On 401, try a single-flight session re-validation before giving up.
  if (result.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      result = await send();
    }
    if (result.status === 401) {
      await authClient.signOut();
    }
  }

  return result;
}

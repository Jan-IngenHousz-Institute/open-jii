import { getSessionToken, hasSessionToken } from "~/shared/api/session-cookie";

// Auth seam, injected by shared/composition/auth-wiring.ts at module load so
// shared/api carries no dependency on the auth feature.
export interface AuthRefreshHandler {
  getCookie(): string | null | undefined;
  hasCachedSession(): boolean;
  refreshSession(): Promise<boolean>;
  signOut(): Promise<void>;
}

let authHandler: AuthRefreshHandler | null = null;

export function configureAuthRefresh(handler: AuthRefreshHandler): void {
  authHandler = handler;
}

// Without this, fetch hangs at the platform default whenever the backend is
// unreachable (Wi-Fi-without-internet, captive portal, sleeping device). 10s is
// generous for any real call and fails fast otherwise.
export const FETCH_TIMEOUT_MS = 10_000;

const SAFE_METHODS = new Set(["GET", "HEAD"]);

// oRPC builds the Request; this wrapper mirrors the previous ts-rest fetcher:
// inject the session cookie, enforce a 10s timeout, forward upstream aborts
// (React Query unmount), and retry once after a single-flight session refresh
// on 401.
export async function orpcFetch(
  request: Request,
  init: RequestInit | undefined,
): Promise<Response> {
  const cookie = authHandler?.getCookie();
  const send = (requestCookie: string | null | undefined) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const upstream = init?.signal ?? request.signal;
    if (upstream) {
      if (upstream.aborted) controller.abort();
      else upstream.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const headers = new Headers(request.headers);
    if (requestCookie) {
      headers.set("Cookie", requestCookie);
    }

    return fetch(request.clone(), { signal: controller.signal, headers }).finally(() =>
      clearTimeout(timeoutId),
    );
  };

  let result = await send(cookie);

  // On 401, try a single-flight session re-validation before giving up.
  if (result.status === 401 && authHandler) {
    const handler = authHandler;
    const sentToken = getSessionToken(cookie);
    // A 401 for a session that has since been replaced says nothing about the
    // current one. Better Auth keeps the token when getSession slides it.
    const sentCurrentSession = () => getSessionToken(handler.getCookie()) === sentToken;
    if (sentToken) {
      if (!sentCurrentSession()) return result;
      if ((await handler.refreshSession()) && sentCurrentSession()) {
        result = await send(handler.getCookie());
      }
      if (result.status === 401 && sentCurrentSession()) {
        await handler.signOut();
      }
    } else if (hasSessionToken(handler.getCookie())) {
      // Sent before a sign-in stored its token. Only a read is replayed under the
      // new session; a write was meant for whoever the app showed when it started.
      if (SAFE_METHODS.has(request.method)) {
        result = await send(handler.getCookie());
      }
    } else if (handler.hasCachedSession()) {
      // Signing out with no session would wipe an OAuth sign-in in progress, but
      // a cached session whose cookie has expired must still be cleared.
      await handler.signOut();
    }
  }

  return result;
}

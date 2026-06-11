import { tsRestFetchApi } from "@ts-rest/core";
import type { ApiFetcherArgs } from "@ts-rest/core";
import { getEnvVar } from "~/shared/stores/environment-store";

// Without this, fetch hangs at the platform default whenever the backend is
// unreachable (Wi-Fi-without-internet, captive portal, sleeping device). The
// hung promises cascade across mounted queries and the UI lags for tens of
// seconds offline. 10s is generous for any real call and fails fast otherwise.
const FETCH_TIMEOUT_MS = 10_000;

// Auth seam, injected by shared/composition/auth-wiring.ts at module load so
// shared/api carries no dependency on the auth feature.
export interface AuthRefreshHandler {
  getCookie(): string | null | undefined;
  refreshSession(): Promise<boolean>;
  signOut(): Promise<void>;
}

let authHandler: AuthRefreshHandler | null = null;

export function configureAuthRefresh(handler: AuthRefreshHandler): void {
  authHandler = handler;
}

function removeTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function removeLeadingSlashes(value: string) {
  return value.replace(/^\/+/, "");
}

export const customApiFetcher = async (args: ApiFetcherArgs) => {
  const auth = authHandler;

  const base = removeTrailingSlashes(getEnvVar("BACKEND_URI"));
  const path = removeLeadingSlashes(args.path);
  const fullPath = `${base}/${path}`;

  const send = () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    // Honor any upstream signal (e.g. React Query unmount) by forwarding aborts.
    const upstream = args.signal;
    if (upstream) {
      if (upstream.aborted) controller.abort();
      else upstream.addEventListener("abort", () => controller.abort(), { once: true });
    }
    const cookie = auth?.getCookie();
    return tsRestFetchApi({
      ...args,
      path: fullPath,
      signal: controller.signal,
      headers: {
        ...args.headers,
        ...(cookie ? { Cookie: cookie } : {}),
      },
    }).finally(() => clearTimeout(timeoutId));
  };

  let result = await send();

  // On 401, try a single-flight session re-validation before giving up.
  // If the session is still valid on the server, the cookie store gets
  // refreshed and the retry succeeds without a visible sign-out.
  if (result?.status === 401 && auth) {
    const refreshed = await auth.refreshSession();
    if (refreshed) {
      result = await send();
    }
    if (result?.status === 401) {
      await auth.signOut();
    }
  }

  return result;
};

export const baseClientOptions = {
  baseUrl: "",
  baseHeaders: {
    "x-app-source": "ts-rest",
  },
  api: customApiFetcher,
} as const;

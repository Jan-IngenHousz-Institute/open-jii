import { tsRestFetchApi } from "@ts-rest/core";
import type { ApiFetcherArgs } from "@ts-rest/core";
import { refreshSession } from "~/features/auth/api/refresh.api";
import { getAuthClient } from "~/features/auth/services/auth";
import { getEnvVar } from "~/shared/stores/environment-store";

// Without this, fetch hangs at the platform default whenever the backend is
// unreachable (Wi-Fi-without-internet, captive portal, sleeping device). The
// hung promises cascade across mounted queries and the UI lags for tens of
// seconds offline. 10s is generous for any real call and fails fast otherwise.
const FETCH_TIMEOUT_MS = 10_000;

function removeTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function removeLeadingSlashes(value: string) {
  return value.replace(/^\/+/, "");
}

export const customApiFetcher = async (args: ApiFetcherArgs) => {
  const authClient = getAuthClient();

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
    return tsRestFetchApi({
      ...args,
      path: fullPath,
      signal: controller.signal,
      headers: {
        ...args.headers,
        ...(authClient.getCookie() ? { Cookie: authClient.getCookie() } : {}),
      },
    }).finally(() => clearTimeout(timeoutId));
  };

  let result = await send();

  // On 401, try a single-flight session re-validation before giving up.
  // If the session is still valid on the server, the cookie store gets
  // refreshed and the retry succeeds without a visible sign-out.
  if (result?.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      result = await send();
    }
    if (result?.status === 401) {
      await authClient.signOut();
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

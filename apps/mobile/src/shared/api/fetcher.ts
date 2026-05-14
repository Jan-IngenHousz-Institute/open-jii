import { tsRestFetchApi } from "@ts-rest/core";
import type { ApiFetcherArgs } from "@ts-rest/core";
import { refreshSession } from "~/features/auth/api/refresh.api";
import { getAuthClient } from "~/features/auth/services/auth";
import { getEnvVar } from "~/shared/stores/environment-store";

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

  const send = () =>
    tsRestFetchApi({
      ...args,
      path: fullPath,
      headers: {
        ...args.headers,
        ...(authClient.getCookie() ? { Cookie: authClient.getCookie() } : {}),
      },
    });

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

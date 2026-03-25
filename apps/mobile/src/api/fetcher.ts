import { tsRestFetchApi } from "@ts-rest/core";
import type { ApiFetcherArgs } from "@ts-rest/core";
import { getAuthClient } from "~/services/auth";
import { clearSessionFlag } from "~/services/session-persistence";
import { getEnvVar } from "~/stores/environment-store";

function removeTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function removeLeadingSlashes(value: string) {
  return value.replace(/^\/+/, "");
}

export const customApiFetcher = async (args: ApiFetcherArgs) => {
  const authClient = getAuthClient();
  const cookies = authClient.getCookie();

  const base = removeTrailingSlashes(getEnvVar("BACKEND_URI"));
  const path = removeLeadingSlashes(args.path);
  const fullPath = `${base}/${path}`;

  const result = await tsRestFetchApi({
    ...args,
    path: fullPath,
    headers: {
      ...args.headers,
      ...(cookies ? { Cookie: cookies } : {}),
    },
  });

  if (result?.status === 401) {
    await clearSessionFlag();
    await authClient.signOut();
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

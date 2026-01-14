import { tsRestFetchApi } from "@ts-rest/core";
import type { ApiFetcherArgs } from "@ts-rest/core";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import { authClient } from "~/lib/auth-client";
import { getEnvVar } from "~/stores/environment-store";

import { contract } from "@repo/api";

function removeTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function removeLeadingSlashes(value: string) {
  return value.replace(/^\/+/, "");
}

const customApiFetcher = async (args: ApiFetcherArgs) => {
  // Get cookies from Better Auth client
  const cookies = authClient.getCookie();

  const enhancedHeaders = {
    ...args.headers,
    ...(cookies ? { Cookie: cookies } : {}),
  };

  const base = removeTrailingSlashes(getEnvVar("BACKEND_URI"));
  const path = removeLeadingSlashes(args.path);
  const fullPath = `${base}/${path}`;

  const result = await tsRestFetchApi({
    ...args,
    path: fullPath,
    headers: enhancedHeaders,
  });

  // Clear session on 401 (unauthorized)
  if (result?.status === 401) {
    await authClient.signOut();
  }

  return result;
};

export const tsr = initTsrReactQuery(contract, {
  baseUrl: "",
  baseHeaders: {
    "x-app-source": "ts-rest",
  },
  api: customApiFetcher,
});

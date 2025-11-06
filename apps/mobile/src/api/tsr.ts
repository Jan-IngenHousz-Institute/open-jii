import { tsRestFetchApi } from "@ts-rest/core";
import type { ApiFetcherArgs } from "@ts-rest/core";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import { useSessionStore } from "~/hooks/use-session-store";
import { getEnvName, getEnvVar } from "~/stores/environment-store";

import { contract } from "@repo/api";

function removeTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function removeLeadingSlashes(value: string) {
  return value.replace(/^\/+/, "");
}

const customApiFetcher = async (args: ApiFetcherArgs) => {
  const token = useSessionStore.getState().session?.token;

  const envName = getEnvName();

  const enhancedHeaders = {
    ...args.headers,
    Cookie: token ? `__Secure-authjs.${envName}.session-token=${token}` : "",
  };

  const base = removeTrailingSlashes(getEnvVar("BACKEND_URI"));
  const path = removeLeadingSlashes(args.path);
  const fullPath = `${base}/${path}`;

  const result = await tsRestFetchApi({
    ...args,
    path: fullPath,
    headers: enhancedHeaders,
  });

  if (result?.status === 401) {
    useSessionStore.getState().clearSession();
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

import { tsRestFetchApi } from "@ts-rest/core";
import type { ApiFetcherArgs } from "@ts-rest/core";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import { useSessionStore } from "~/hooks/use-session-store";
import { assertEnvVariables } from "~/utils/assert";

import { contract } from "@repo/api";

const { BACKEND_URI } = assertEnvVariables({ BACKEND_URI: process.env.BACKEND_URI });

const customApiFetcher = async (args: ApiFetcherArgs) => {
  const token = useSessionStore.getState().session?.token;

  const enhancedHeaders = {
    ...args.headers,
    Cookie: token ? `authjs.session-token=${token}` : "",
  };

  return tsRestFetchApi({
    ...args,
    headers: enhancedHeaders,
  });
};

export const tsr = initTsrReactQuery(contract, {
  baseUrl: BACKEND_URI,
  baseHeaders: {
    "x-app-source": "ts-rest",
  },
  api: customApiFetcher,
});

import { tsRestFetchApi } from "@ts-rest/core";
import type { ApiFetcherArgs } from "@ts-rest/core";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";

import { contract } from "@repo/api";

const customApiFetcher = async (args: ApiFetcherArgs) => {
  const enhancedHeaders = {
    ...args.headers,
  };

  return tsRestFetchApi({
    ...args,
    headers: enhancedHeaders,
  });
};

export const tsr = initTsrReactQuery(contract, {
  // eslint-disable-next-line no-restricted-properties, turbo/no-undeclared-env-vars
  baseUrl: "https://api.dev.openjii.org",
  baseHeaders: {
    "x-app-source": "ts-rest",
  },
  api: customApiFetcher,
  credentials: "include",
});

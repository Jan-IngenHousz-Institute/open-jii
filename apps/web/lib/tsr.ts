import { initContract, tsRestFetchApi } from "@ts-rest/core";
import type { ApiFetcherArgs } from "@ts-rest/core";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import { env } from "~/env";

import { experimentContract, macroContract, protocolContract, userContract } from "@repo/api";

const customApiFetcher = async (args: ApiFetcherArgs) => {
  const enhancedHeaders = {
    ...args.headers,
  };

  return tsRestFetchApi({
    ...args,
    headers: enhancedHeaders,
  });
};

// Initialize the main contract
const c = initContract();

// Export the main API contract
export const contract = c.router({
  experiments: experimentContract,
  macros: macroContract,
  protocols: protocolContract,
  users: userContract,
});

export const tsr = initTsrReactQuery(contract, {
  baseUrl: env.NEXT_PUBLIC_API_URL,
  baseHeaders: {
    "x-app-source": "ts-rest",
  },
  api: customApiFetcher,
  credentials: "include",
});

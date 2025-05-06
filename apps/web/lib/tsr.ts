import { tsRestFetchApi } from "@ts-rest/core";
import type { ApiFetcherArgs } from "@ts-rest/core";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";

import { contract } from "@repo/api";

// import { getSession } from "./session";

const customApiFetcher = async (args: ApiFetcherArgs) => {
  // const session = await getSession();
  // const token = session?.userId ? `Bearer ${session.userId}` : undefined;

  const enhancedHeaders = {
    ...args.headers,
    // Authorization: token || "",
  };

  return tsRestFetchApi({
    ...args,
    headers: enhancedHeaders,
  });
};

export const tsr = initTsrReactQuery(contract, {
  baseUrl: "http://localhost:3020",
  baseHeaders: {
    "x-app-source": "ts-rest",
  },
  api: customApiFetcher,
});

import { tsRestFetchApi } from "@ts-rest/core";
import type { ApiFetcherArgs } from "@ts-rest/core";

export async function tsrCustomApiFetcher(args: ApiFetcherArgs) {
  const enhancedHeaders = {
    ...args.headers,
  };

  const response = await tsRestFetchApi({
    ...args,
    headers: enhancedHeaders,
  });

  if (response.status >= 400) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw response;
  }

  return response;
}

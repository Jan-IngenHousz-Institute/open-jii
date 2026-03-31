import { initContract, tsRestFetchApi } from "@ts-rest/core";
import type {
  AppRoute,
  ApiFetcherArgs,
  ClientInferResponses,
  HTTPStatusCode,
  SuccessfulHttpStatusCode,
} from "@ts-rest/core";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import type { InferClientArgs, UseMutationOptions } from "@ts-rest/react-query/v5";
import { env } from "~/env";

import { experimentContract, macroContract, protocolContract, userContract } from "@repo/api";

const customApiFetcher = async (args: ApiFetcherArgs) => {
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

// Maps the status codes in the route's `responses` to only the non-2xx ones.
// Intersecting with HTTPStatusCode keeps the result a valid HTTPStatusCode subtype.
type ErrorStatusOf<TRoute extends AppRoute> = Exclude<
  keyof TRoute["responses"] & HTTPStatusCode,
  SuccessfulHttpStatusCode
>;

// The union of response shapes that can be thrown as errors for a given route.
export type ContractErrorResponse<TRoute extends AppRoute> = ClientInferResponses<
  TRoute,
  ErrorStatusOf<TRoute>
>;

type RemapOnError<T, TRoute extends AppRoute> = Omit<T, "onError"> & {
  [K in Extract<keyof T, "onError">]?: T[K] extends
    | ((error: infer _E, ...args: infer A) => infer R)
    | undefined
    ? (error: ContractErrorResponse<TRoute>, ...args: A) => R
    : T[K];
};

export type TsRestMutationOptions<
  TRoute extends AppRoute,
  TKeys extends keyof UseMutationOptions<TRoute, InferClientArgs<typeof tsr>> = "onSuccess" | "onError",
> = RemapOnError<Pick<UseMutationOptions<TRoute, InferClientArgs<typeof tsr>>, TKeys>, TRoute>;

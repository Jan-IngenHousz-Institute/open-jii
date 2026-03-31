import { initContract, tsRestFetchApi } from "@ts-rest/core";
import type { AppRoute, ApiFetcherArgs } from "@ts-rest/core";
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

type TsRestError<TRoute extends AppRoute> =
  UseMutationOptions<TRoute, InferClientArgs<typeof tsr>>["onError"] extends
    ((error: infer E, ...args: any) => any) | undefined
    ? E
    : never;

export type ContractError<TRoute extends AppRoute> = Extract<
  Exclude<TsRestError<TRoute>, Error>,
  { status: keyof TRoute["responses"] }
>;

export function isContractError<TRoute extends AppRoute>(
  route: TRoute,
  error: TsRestError<TRoute>,
): error is ContractError<TRoute> {
  if (error instanceof Error) return false;
  if (typeof error !== "object" || error === null || !("status" in error)) return false;
  return String((error as { status: number }).status) in route.responses;
}

type RemapOnError<T, TRoute extends AppRoute> = Omit<T, "onError"> & {
  [K in Extract<keyof T, "onError">]?: T[K] extends
    | ((error: infer E, ...args: infer A) => infer R)
    | undefined
    ? (error: Extract<Exclude<E, Error>, { status: keyof TRoute["responses"] }>, ...args: A) => R
    : T[K];
};

export type TsRestMutationOptions<
  TRoute extends AppRoute,
  TKeys extends keyof UseMutationOptions<TRoute, InferClientArgs<typeof tsr>> = "onSuccess" | "onError",
> = RemapOnError<Pick<UseMutationOptions<TRoute, InferClientArgs<typeof tsr>>, TKeys>, TRoute>;

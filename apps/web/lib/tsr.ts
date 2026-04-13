import { initContract } from "@ts-rest/core";
import type { AppRoute, ErrorHttpStatusCode } from "@ts-rest/core";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import type { InferClientArgs, UseMutationOptions } from "@ts-rest/react-query/v5";
import { env } from "~/env";

import { experimentContract, macroContract, protocolContract, userContract } from "@repo/api";

import { tsrCustomApiFetcher } from "./tsr-custom-fetch";

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
  api: tsrCustomApiFetcher,
  credentials: "include",
});

export type TsrRoute<T> = T extends {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useMutation: (options?: UseMutationOptions<infer TRoute, any>) => any;
}
  ? TRoute
  : never;

export type ContractError<TRoute extends AppRoute> = keyof TRoute["responses"] &
  ErrorHttpStatusCode extends infer K
  ? K extends keyof TRoute["responses"] & ErrorHttpStatusCode
    ? {
        status: K;
        body: TRoute["responses"][K] extends { _output: infer O } ? O : unknown;
        headers: Headers;
      }
    : never
  : never;

export function getContractError<T>(
  _route: T,
  error: unknown,
): ContractError<TsrRoute<T>> | undefined {
  if (error instanceof Error) return undefined;
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  if (typeof (error as { status: unknown }).status !== "number") return undefined;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any
  return error as any;
}

type RemapOnError<T, TRoute extends AppRoute> = Omit<T, "onError"> & {
  [K in Extract<keyof T, "onError">]?: T[K] extends
    | ((error: never, ...args: infer A) => infer R)
    | undefined
    ? (error: ContractError<TRoute>, ...args: A) => R
    : T[K];
};

export type TsRestMutationOptions<
  TRoute extends AppRoute,
  TKeys extends keyof UseMutationOptions<TRoute, InferClientArgs<typeof tsr>>,
> = RemapOnError<Pick<UseMutationOptions<TRoute, InferClientArgs<typeof tsr>>, TKeys>, TRoute>;

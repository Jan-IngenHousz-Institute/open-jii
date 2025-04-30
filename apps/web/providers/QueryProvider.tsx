"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiFetcherArgs, tsRestFetchApi } from "@ts-rest/core";
import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import React from "react";

import { contract } from "@repo/api";

import { getSession } from "../lib/session";

const queryClient = new QueryClient();

export const customApiFetcher = async (args: ApiFetcherArgs) => {
  const session = await getSession();
  const token = session?.userId ? `Bearer ${session.userId}` : undefined;

  const enhancedHeaders = {
    ...args.headers,
    Authorization: token || "",
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

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <tsr.ReactQueryProvider>{children}</tsr.ReactQueryProvider>
    </QueryClientProvider>
  );
}

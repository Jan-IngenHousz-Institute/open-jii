import { QueryClient, QueryCache, QueryClientProvider } from "@tanstack/react-query";
import React, { useRef } from "react";
import { useToast } from "~/context/toast-context";

const defaultOptions = {
  queries: {
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  },
};

export function ConfiguredQueryClientProvider({ children }) {
  const { showToast } = useToast();

  const queryClientRef = useRef<QueryClient>(undefined);

  if (!queryClientRef.current) {
    const queryCache = new QueryCache({
      onError: (error: any) => {
        const message = error?.body?.message ?? error?.message ?? "Something went wrong";
        console.log("showing error", message);
        showToast(message, "error");
      },
    });

    queryClientRef.current = new QueryClient({
      queryCache,
      defaultOptions,
    });
  }

  return <QueryClientProvider client={queryClientRef.current}>{children}</QueryClientProvider>;
}

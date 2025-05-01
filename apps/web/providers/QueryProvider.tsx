"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { tsr } from "../lib/tsr";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// Create a client-side QueryClient instance
const queryClient = new QueryClient();

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <tsr.ReactQueryProvider>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </tsr.ReactQueryProvider>
    </QueryClientProvider>
  );
}

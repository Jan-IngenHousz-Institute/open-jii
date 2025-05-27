"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { toast } from "@repo/ui/hooks";

import { tsr } from "../lib/tsr";

// Create a client-side QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      onError: (error) => {
        toast({
          description: error.message,
          title: error.name,
          variant: "destructive",
        });
      },
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <tsr.ReactQueryProvider>
        {children}
        {process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true" && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </tsr.ReactQueryProvider>
    </QueryClientProvider>
  );
}

"use client";

import { tsr } from "@/lib/tsr";
import { parseApiError } from "@/util/apiError";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { env } from "~/env";

import { toast } from "@repo/ui/hooks";

// Create a client-side QueryClient instance
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      const parsedError = parseApiError(error);
      toast({
        title: parsedError?.message ?? "Error",
        variant: "destructive",
      });
    },
  }),
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <tsr.ReactQueryProvider>
        {children}
        {env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true" && <ReactQueryDevtools initialIsOpen={false} />}
      </tsr.ReactQueryProvider>
    </QueryClientProvider>
  );
}

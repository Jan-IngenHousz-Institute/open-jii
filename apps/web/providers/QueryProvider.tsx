"use client";

import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { env } from "~/env";

import { toast } from "@repo/ui/hooks/use-toast";

import { getOrpcError } from "@/lib/orpc";
import { parseApiError } from "@/util/apiError";

// Create a client-side QueryClient instance
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      // oRPC nests the server error payload under ORPCError.data; fall back to
      // the raw error for non-oRPC throws (e.g. the native upload's UploadError).
      const parsedError = parseApiError(getOrpcError(error)?.data ?? error);
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
      {children}
      {env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

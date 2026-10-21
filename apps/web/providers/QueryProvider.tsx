"use client";

import { parseApiError } from "@/util/apiError";
import { QueryClient, QueryClientProvider, MutationCache, isServer } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect } from "react";
import { env } from "~/env";

import { useSession } from "@repo/auth/client";
import { toast } from "@repo/ui/hooks/use-toast";

// A page visited again within this window renders from cache, and data the server put into the
// page is not fetched again the moment it loads.
const FRESH_FOR_MS = 30_000;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: FRESH_FOR_MS } },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.errorHandledLocally === true) return;
        // oRPC nests the server error payload under ORPCError.data; fall back to
        // the raw error for non-oRPC throws (e.g. the native upload's UploadError).
        const parsedError = parseApiError(error);
        toast({
          title: parsedError?.message ?? "Error",
          variant: "destructive",
        });
      },
    }),
  });
}

let browserQueryClient: QueryClient | undefined;
let browserIdentity: string | undefined;

// One client per server render, so one request's data never reaches another's; one for the
// whole session in the browser.
function getQueryClient(identity?: string) {
  if (isServer) {
    return makeQueryClient();
  }
  if (identity !== undefined && browserIdentity !== identity) {
    void browserQueryClient?.cancelQueries();
    browserQueryClient?.clear();
    browserQueryClient = makeQueryClient();
    browserIdentity = identity;
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  let identity: string | undefined;
  if (!isPending) identity = session?.user.id ?? "signed-out";
  const queryClient = getQueryClient(identity);
  useEffect(
    () => () => {
      void queryClient.cancelQueries();
    },
    [queryClient],
  );

  return (
    <QueryClientProvider key={identity ?? browserIdentity} client={queryClient}>
      {children}
      {env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

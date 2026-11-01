"use client";

import { settledIdentity } from "@/lib/session-identity";
import { parseApiError } from "@/util/apiError";
import { QueryClient, QueryClientProvider, MutationCache, isServer } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState } from "react";
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
function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

interface CacheOwner {
  identity: string | undefined;
  client: QueryClient;
  generation: number;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const identity = settledIdentity(useSession());
  const [owner, setOwner] = useState<CacheOwner>(() => ({
    identity: browserIdentity,
    client: getQueryClient(),
    generation: 0,
  }));
  let current = owner;
  if (identity !== undefined && identity !== owner.identity) {
    // The first answer keeps the cache the page was rendered and fetched with, under the same
    // cookie. A later change of person starts an empty cache and remounts its observers.
    current =
      owner.identity === undefined
        ? { ...owner, identity }
        : { identity, client: makeQueryClient(), generation: owner.generation + 1 };
    setOwner(current);
  }
  useEffect(() => {
    const previous = browserQueryClient;
    browserQueryClient = current.client;
    browserIdentity = current.identity;
    if (previous !== undefined && previous !== current.client) {
      void previous.cancelQueries();
      previous.clear();
    }
  }, [current]);

  return (
    <QueryClientProvider key={current.generation} client={current.client}>
      {children}
      {env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

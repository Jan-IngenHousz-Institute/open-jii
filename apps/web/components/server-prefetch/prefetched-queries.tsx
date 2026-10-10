import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import {
  HydrationBoundary,
  QueryClient,
  defaultShouldDehydrateQuery,
  dehydrate,
} from "@tanstack/react-query";
import type { DefaultError, FetchQueryOptions, QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { QueryUtils } from "~/lib/orpc";
import { createServerOrpcClient } from "~/lib/server-orpc";

// The longest a page's HTML waits for its first data. Whatever has not arrived by then the browser
// fetches itself, as it would without this.
const PREFETCH_BUDGET_MS = 1000;

type PrefetchOptions = FetchQueryOptions<unknown, DefaultError, unknown, QueryKey>;

interface PrefetchedQueriesProps {
  queries: (utils: QueryUtils) => PrefetchOptions[];
  /** Leaves a result out of the page when false, for data too large to render on the server. */
  embedWhen?: (data: unknown) => boolean;
  children: ReactNode;
}

/**
 * Fetches a page's first data while the server renders it and hands it to the browser's query
 * cache, so the page arrives with its content instead of fetching it once its code has loaded.
 * The queries are built by the same functions the client hooks use, so their keys match.
 */
export async function PrefetchedQueries({ queries, embedWhen, children }: PrefetchedQueriesProps) {
  const queryClient = new QueryClient();
  const utils = createTanstackQueryUtils(await createServerOrpcClient());
  const prefetches = Promise.all(
    queries(utils).map((options) => queryClient.prefetchQuery(options)),
  );

  let budget: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    prefetches,
    new Promise((resolve) => {
      budget = setTimeout(resolve, PREFETCH_BUDGET_MS);
    }),
  ]);
  clearTimeout(budget);

  const state = dehydrate(queryClient, {
    shouldDehydrateQuery: (query) =>
      defaultShouldDehydrateQuery(query) && (embedWhen?.(query.state.data) ?? true),
  });

  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}

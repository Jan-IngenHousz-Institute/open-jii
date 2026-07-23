import { defaultShouldDehydrateQuery } from "@tanstack/react-query";
import type { Query } from "@tanstack/react-query";

// Only these roots are persisted; persisting the whole cache OOM'd the bridge.
export const PERSISTED_QUERY_ROOTS: ReadonlySet<string> = new Set([
  "userProfile",
  "experiments",
  "workbook-version",
  "precache-experiment-data",
  "contentful",
]);

export function shouldPersistQuery(query: Query): boolean {
  const root = query.queryKey[0];
  if (typeof root !== "string" || !PERSISTED_QUERY_ROOTS.has(root)) return false;
  // Allow data-bearing non-success so an offline refetch error can't evict it.
  return defaultShouldDehydrateQuery(query) || query.state.data !== undefined;
}

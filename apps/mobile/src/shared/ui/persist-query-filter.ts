import { defaultShouldDehydrateQuery } from "@tanstack/react-query";
import type { Query } from "@tanstack/react-query";

// Only these roots are persisted; persisting the whole cache OOM'd the bridge.
// oRPC keys are [path, { input, type }] with `path` an array, so those roots
// are matched as "domain/operation" strings; plain-key roots match directly.
// Operation-level (not just domain-level) so heavy siblings like
// experiments/getExperimentData stay out of the persisted blob.
export const PERSISTED_QUERY_ROOTS: ReadonlySet<string> = new Set([
  "users/getUserProfile",
  "experiments/listExperiments",
  "workbooks/getWorkbookVersion",
  "precache-experiment-data",
  "contentful",
]);

function queryRoot(query: Query): string | undefined {
  const [first] = query.queryKey;
  if (typeof first === "string") return first;
  if (Array.isArray(first) && first.every((p): p is string => typeof p === "string")) {
    return first.join("/");
  }
  return undefined;
}

export function shouldPersistQuery(query: Query): boolean {
  const root = queryRoot(query);
  if (root === undefined || !PERSISTED_QUERY_ROOTS.has(root)) return false;
  // Allow data-bearing non-success so an offline refetch error can't evict it.
  return defaultShouldDehydrateQuery(query) || query.state.data !== undefined;
}

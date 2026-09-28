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

// A root alone is too coarse where one operation serves both an offline-critical
// query and a paginated one. `maxAge` and `gcTime` are both infinite here, so
// every page of every search the student ever ran would be kept forever.
const PERSISTED_INPUTS: Record<string, (input: unknown) => boolean> = {
  "experiments/listExperiments": isRelatedScopeInput,
};

function isRelatedScopeInput(input: unknown): boolean {
  if (typeof input !== "object" || input === null) return false;
  const entries = Object.entries(input as Record<string, unknown>).filter(
    ([, value]) => value !== undefined,
  );
  return entries.length === 1 && entries[0]?.[0] === "scope" && entries[0]?.[1] === "related";
}

function queryRoot(query: Query): string | undefined {
  const [first] = query.queryKey;
  if (typeof first === "string") return first;
  if (Array.isArray(first) && first.every((p): p is string => typeof p === "string")) {
    return first.join("/");
  }
  return undefined;
}

function queryInput(query: Query): unknown {
  const [, second] = query.queryKey;
  if (typeof second !== "object" || second === null) return undefined;
  return (second as { input?: unknown }).input;
}

export function shouldPersistQuery(query: Query): boolean {
  const root = queryRoot(query);
  if (root === undefined || !PERSISTED_QUERY_ROOTS.has(root)) return false;
  const admitsInput = PERSISTED_INPUTS[root];
  if (admitsInput && !admitsInput(queryInput(query))) return false;
  // Allow data-bearing non-success so an offline refetch error can't evict it.
  return defaultShouldDehydrateQuery(query) || query.state.data !== undefined;
}

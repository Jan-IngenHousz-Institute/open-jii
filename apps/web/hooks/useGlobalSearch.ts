import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { useDebounce } from "./useDebounce";

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_LIMIT = 20;

/**
 * Debounced global search across experiments, protocols and macros. The query is disabled until
 * the (trimmed) input reaches {@link MIN_QUERY_LENGTH} characters. `isSearching` is true while the
 * user has typed enough but results are still debouncing or fetching, so callers can show a single
 * loading state. Previous results are kept while the next query loads to avoid flicker.
 */
export function useGlobalSearch(query: string, limit = DEFAULT_LIMIT) {
  const trimmed = query.trim();
  const [debouncedQuery, isDebounced] = useDebounce(trimmed, SEARCH_DEBOUNCE_MS);
  const enabled = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const result = useQuery(
    orpc.search.globalSearch.queryOptions({
      input: { query: debouncedQuery, limit },
      enabled,
      placeholderData: (prev) => prev,
    }),
  );

  const isSearching =
    trimmed.length >= MIN_QUERY_LENGTH && (!isDebounced || (enabled && result.isFetching));

  return {
    ...result,
    results: result.data?.results ?? [],
    isSearching,
    enabled,
    minQueryLength: MIN_QUERY_LENGTH,
  };
}

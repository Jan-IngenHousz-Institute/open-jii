import { ANONYMOUS_PRINCIPAL, withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

import { useDebounce } from "./useDebounce";

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_LIMIT = 20;

/**
 * Debounced global search across experiments, protocols, macros, workbooks and organizations. The
 * query is disabled until
 * the (trimmed) input reaches {@link MIN_QUERY_LENGTH} characters. `isSearching` is true while the
 * user has typed enough but results are still debouncing or fetching, so callers can show a single
 * loading state. Previous results are kept while the next query loads to avoid flicker.
 */
export function useGlobalSearch(query: string, limit = DEFAULT_LIMIT) {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;
  const principal = userId ?? ANONYMOUS_PRINCIPAL;
  const trimmed = query.trim();
  const [debouncedQuery, isDebounced] = useDebounce(trimmed, SEARCH_DEBOUNCE_MS);
  const enabled = debouncedQuery.length >= MIN_QUERY_LENGTH;
  const queryEnabled = enabled && !isSessionPending;
  const input = { query: debouncedQuery, limit };

  const result = useQuery(
    orpc.search.globalSearch.queryOptions({
      input,
      queryKey: withPrincipal(orpc.search.globalSearch.queryKey({ input }), userId),
      enabled: queryEnabled,
      meta: { principal },
      // Keep a settled result while the same person types the next term, but never
      // carry private results through a sign-out/sign-in transition.
      placeholderData: (previous, previousQuery) =>
        previousQuery?.meta?.principal === principal ? previous : undefined,
    }),
  );

  const isSearching =
    trimmed.length >= MIN_QUERY_LENGTH &&
    (isSessionPending || !isDebounced || (queryEnabled && result.isFetching));

  return {
    ...result,
    results: result.data?.results ?? [],
    isSearching,
    enabled,
    minQueryLength: MIN_QUERY_LENGTH,
  };
}

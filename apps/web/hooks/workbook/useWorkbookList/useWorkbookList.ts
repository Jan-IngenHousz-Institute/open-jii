import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import { useDebounce } from "../../useDebounce";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Workbook list, optionally narrowed by the server's full-text search. The server
 * ranks the results and also matches creator and linked experiment/protocol/macro
 * names, so callers must render the list as-is instead of filtering it again.
 * Previous results are kept while the next search loads; `isSearching` covers both
 * the debounce window and the fetch.
 */
export function useWorkbookList({ search = "" }: { search?: string } = {}) {
  const trimmed = search.trim();
  const [debouncedSearch] = useDebounce(trimmed, SEARCH_DEBOUNCE_MS);

  const query = useQuery(
    orpc.workbooks.listWorkbooks.queryOptions({
      input: { search: debouncedSearch === "" ? undefined : debouncedSearch },
      placeholderData: (prev) => prev,
    }),
  );

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    // Compared against the settled term rather than `useDebounce`'s own flag, which
    // also goes pending on mount, when nothing is waiting to be searched yet.
    isSearching: trimmed !== debouncedSearch || query.isFetching,
  };
}

import { useEffect, useState } from "react";

interface SearchPendingOptions {
  search: string;
  debouncedSearch: string;
  isFetching: boolean;
}

/**
 * Reports only fetches caused by a changed search term. Pagination and background
 * refreshes keep the same settled term, so they do not turn the search spinner on.
 */
export function useSearchPending({
  search,
  debouncedSearch,
  isFetching,
}: SearchPendingOptions): boolean {
  const [settledSearch, setSettledSearch] = useState<string | null>(null);

  useEffect(() => {
    if (!isFetching) setSettledSearch(debouncedSearch);
  }, [debouncedSearch, isFetching]);

  if (search.trim() === "") return false;

  const isWaitingForDebounce = search !== debouncedSearch;
  const isFetchingChangedTerm = isFetching && debouncedSearch !== settledSearch;

  return isWaitingForDebounce || isFetchingChangedTerm;
}

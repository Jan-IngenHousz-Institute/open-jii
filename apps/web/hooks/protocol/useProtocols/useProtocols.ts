import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { isPaginatedList } from "@repo/api/shared/listing";

import { useDebounce } from "../../useDebounce";
import { useSearchPending } from "../../useSearchPending";

export const useProtocols = ({ initialSearch = "" }: { initialSearch?: string } = {}) => {
  const [search, setSearchState] = useState<string>(initialSearch);
  const [page, setPage] = useState(1);
  const [debouncedSearch] = useDebounce(search, 300);

  const setSearch = (value: string) => {
    setSearchState(value);
    setPage(1);
  };

  const query = useQuery(
    orpc.protocols.listProtocols.queryOptions({
      input: {
        search: debouncedSearch && debouncedSearch.trim() !== "" ? debouncedSearch : undefined,
        page,
      },
      placeholderData: (prev) => prev,
    }),
  );

  // `page` is always sent, so the response is the envelope; narrow the union.
  const data = query.data && isPaginatedList(query.data) ? query.data : undefined;
  const isSearchPending = useSearchPending({
    search,
    debouncedSearch,
    isFetching: query.isFetching,
  });

  // A mutation or background update can shrink the result set under the current
  // page; snap back into range once a real (non-placeholder) response says so.
  useEffect(() => {
    if (!data || query.isPlaceholderData) return;
    const maxPage = Math.max(1, data.totalPages);
    if (page > maxPage) setPage(maxPage);
  }, [data, query.isPlaceholderData, page]);

  return {
    data,
    isLoading: query.isLoading,
    isPlaceholderData: query.isPlaceholderData,
    isSearchPending,
    error: query.error,
    refetch: query.refetch,
    search,
    debouncedSearch,
    setSearch,
    page,
    setPage,
  };
};

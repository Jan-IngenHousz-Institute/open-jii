import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { zProtocolSort } from "@repo/api/domains/protocol/protocol.schema";
import { isPaginatedList } from "@repo/api/shared/listing";

import { useDebounce } from "../../useDebounce";
import { useListSorting } from "../../useListSorting";
import { useSearchPending } from "../../useSearchPending";
import { protocolsListQuery } from "./protocols-list-query";
import { useProtocolListFilters } from "./useProtocolListFilters";

export const useProtocols = ({ initialSearch = "" }: { initialSearch?: string } = {}) => {
  const [search, setSearchState] = useState<string>(initialSearch);
  const [page, setPage] = useState(1);
  const { sort, setSort, toggleSort } = useListSorting(zProtocolSort);
  const { families, visibilities, setFamilies, setVisibilities, clearFilters, hasActiveFilters } =
    useProtocolListFilters();
  const [debouncedSearch] = useDebounce(search, 300);

  const setSearch = (value: string) => {
    setSearchState(value);
    setPage(1);
  };

  const query = useQuery({
    ...protocolsListQuery(orpc, {
      search: debouncedSearch,
      page,
      sort,
      families,
      visibilities,
    }),
    placeholderData: (prev) => prev,
  });

  // `page` is always sent, so the response is the envelope; narrow the union.
  const data = query.data && isPaginatedList(query.data) ? query.data : undefined;
  const isSearchPending = useSearchPending({
    search,
    debouncedSearch,
    isFetching: query.isFetching,
  });

  // A mutation or background update can shrink the result set under the current
  // page; snap back into range once a real (non-placeholder) response says so.
  if (data && !query.isPlaceholderData && page > Math.max(1, data.totalPages)) {
    setPage(Math.max(1, data.totalPages));
  }

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
    sort,
    setSort: (next: typeof sort) => {
      setSort(next);
      setPage(1);
    },
    toggleSort: (field: (typeof sort)[number]["field"], multi: boolean) => {
      toggleSort(field, multi);
      setPage(1);
    },
    families,
    setFamilies: (values: typeof families) => {
      setFamilies(values);
      setPage(1);
    },
    visibilities,
    setVisibilities: (values: typeof visibilities) => {
      setVisibilities(values);
      setPage(1);
    },
    clearFilters: () => {
      clearFilters();
      setPage(1);
    },
    hasActiveFilters,
  };
};

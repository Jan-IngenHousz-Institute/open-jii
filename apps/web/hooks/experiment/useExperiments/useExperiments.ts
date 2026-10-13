import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { zExperimentSort } from "@repo/api/domains/experiment/experiment.schema";
import { isPaginatedList } from "@repo/api/shared/listing";

import { useDebounce } from "../../useDebounce";
import { useListSorting } from "../../useListSorting";
import { useSearchPending } from "../../useSearchPending";
import { experimentsListQuery } from "./experiments-list-query";
import { useExperimentListFilters } from "./useExperimentListFilters";

export const useExperiments = ({
  initialSearch = "",
  archived = false,
}: {
  initialSearch?: string;
  archived?: boolean;
}) => {
  const filters = useExperimentListFilters({ archived });
  const { statuses, visibilities } = filters;
  const [search, setSearchState] = useState<string>(initialSearch);
  const [page, setPage] = useState(1);
  const { sort, setSort, toggleSort } = useListSorting(zExperimentSort);
  const [debouncedSearch] = useDebounce(search, 300);

  const setSearch = (value: string) => {
    setSearchState(value);
    setPage(1);
  };

  const setStatuses = (values: typeof statuses) => {
    filters.setStatuses(values);
    setPage(1);
  };

  const setVisibilities = (values: typeof visibilities) => {
    filters.setVisibilities(values);
    setPage(1);
  };

  const clearFilters = () => {
    filters.clearFilters();
    setPage(1);
  };

  const query = useQuery({
    ...experimentsListQuery(orpc, {
      archived,
      statuses,
      visibilities,
      search: debouncedSearch,
      page,
      sort,
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
    statuses,
    setStatuses,
    visibilities,
    setVisibilities,
    clearFilters,
    hasActiveFilters: filters.hasActiveFilters,
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
  };
};

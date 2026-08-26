import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { ExperimentStatus } from "@repo/api/domains/experiment/experiment.schema";
import { isPaginatedList } from "@repo/api/shared/listing";

import { useDebounce } from "../../useDebounce";

export const useExperiments = ({
  initialStatus = undefined,
  initialSearch = "",
  archived = false,
}: {
  initialStatus?: ExperimentStatus | undefined;
  initialSearch?: string;
  archived?: boolean;
}) => {
  const [status, setStatusState] = useState<ExperimentStatus | undefined>(initialStatus);
  const [search, setSearchState] = useState<string>(initialSearch);
  const [page, setPage] = useState(1);
  const [debouncedSearch] = useDebounce(search, 300);

  const setSearch = (value: string) => {
    setSearchState(value);
    setPage(1);
  };

  const setStatus = (value: ExperimentStatus | undefined) => {
    setStatusState(value);
    setPage(1);
  };

  const query = useQuery(
    orpc.experiments.listExperiments.queryOptions({
      input: {
        scope: archived ? "related" : undefined,
        status: archived ? "archived" : status,
        search: debouncedSearch && debouncedSearch.trim() !== "" ? debouncedSearch : undefined,
        page,
      },
      placeholderData: (prev) => prev,
    }),
  );

  // `page` is always sent, so the response is the envelope; narrow the union.
  const data = query.data && isPaginatedList(query.data) ? query.data : undefined;

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
    error: query.error,
    refetch: query.refetch,
    status,
    setStatus,
    search,
    setSearch,
    page,
    setPage,
  };
};

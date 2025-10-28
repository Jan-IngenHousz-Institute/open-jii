import { tsr } from "@/lib/tsr";
import { useState } from "react";

import type { ExperimentStatus } from "@repo/api";

import { useDebounce } from "../../useDebounce";

export type ExperimentFilter = "member" | "all";

export const useExperiments = ({
  initialFilter = "member",
  initialStatus = undefined,
  initialSearch = "",
  archived = false,
}: {
  initialFilter?: ExperimentFilter;
  initialStatus?: ExperimentStatus | undefined;
  initialSearch?: string;
  archived?: boolean;
}) => {
  const [filter, setFilter] = useState<ExperimentFilter>(initialFilter);
  const [status, setStatus] = useState<ExperimentStatus | undefined>(initialStatus);
  const [search, setSearch] = useState<string>(initialSearch);
  const [debouncedSearch] = useDebounce(search, 300);

  // When filter is "all", we don't pass any filter to the API
  const { data } = tsr.experiments.listExperiments.useQuery({
    queryData: {
      query: {
        filter: filter === "all" ? undefined : filter,
        status: archived ? "archived" : status,
        search: debouncedSearch && debouncedSearch.trim() !== "" ? debouncedSearch : undefined,
      },
    },
    queryKey: ["experiments", filter, status, debouncedSearch, archived],
  });

  // Return query result with filter, status, and search controls
  return {
    data,
    filter,
    setFilter,
    status,
    setStatus,
    search,
    setSearch,
  };
};

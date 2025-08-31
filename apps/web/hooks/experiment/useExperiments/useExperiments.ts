import { tsr } from "@/lib/tsr";
import { useState } from "react";

import type { ExperimentStatus } from "@repo/api";

import { useDebounce } from "../../useDebounce";

export type ExperimentFilter = "my" | "member" | "related" | "all";

export const useExperiments = ({
  initialFilter = "my",
  initialStatus = undefined,
  initialSearch = "",
}: {
  initialFilter?: ExperimentFilter;
  initialStatus?: ExperimentStatus | undefined;
  initialSearch?: string;
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
        status,
        search: debouncedSearch && debouncedSearch.trim() !== "" ? debouncedSearch : undefined,
      },
    },
    queryKey: ["experiments", filter, status, debouncedSearch],
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

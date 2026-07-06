import { tsr } from "@/lib/tsr";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useState, useCallback } from "react";

import type { ExperimentStatus } from "@repo/api/schemas/experiment.schema";

import { useDebounce } from "../../useDebounce";

export type ExperimentFilter = "accessible" | "public";

export const useExperiments = ({
  initialFilter = "accessible",
  initialStatus = undefined,
  initialSearch = "",
  archived = false,
}: {
  initialFilter?: ExperimentFilter;
  initialStatus?: ExperimentStatus | undefined;
  initialSearch?: string;
  archived?: boolean;
}) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const rawScope = searchParams.get("scope");

  const [filter, setFilterState] = useState<ExperimentFilter>(
    rawScope === "public" ? "public" : initialFilter,
  );
  const [status, setStatus] = useState<ExperimentStatus | undefined>(initialStatus);
  const [search, setSearch] = useState<string>(initialSearch);
  const [debouncedSearch] = useDebounce(search, 300);

  // Helper to create query string by merging current searchParams
  const createQueryString = useCallback(
    (name: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) {
        params.delete(name);
      } else {
        params.set(name, value);
      }
      return params.toString();
    },
    [searchParams],
  );

  // Sync filter state with URL
  const setFilter = useCallback(
    (value: ExperimentFilter) => {
      setFilterState(value);
      const queryString = createQueryString("scope", value === "public" ? "public" : null);
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router, createQueryString],
  );

  const { data } = tsr.experiments.listExperiments.useQuery({
    queryData: {
      query: {
        scope: filter === "public" ? "public" : undefined,
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

import { tsr } from "@/lib/tsr";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

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
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Get filter from URL params, defaulting to initialFilter
  const rawFilter = searchParams.get("filter");

  const [filter, setFilterState] = useState<ExperimentFilter>(
    rawFilter === "all" ? "all" : rawFilter === "member" ? "member" : initialFilter,
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

  // Clean up invalid filter in URL
  useEffect(() => {
    if (rawFilter !== null && rawFilter !== "all") {
      const queryString = createQueryString("filter", null);
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newUrl, { scroll: false });
    }
  }, [rawFilter, pathname, router, createQueryString]);

  // Sync filter state with URL
  const setFilter = useCallback(
    (value: ExperimentFilter) => {
      setFilterState(value);
      const queryString = createQueryString("filter", value === "all" ? "all" : null);
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router, createQueryString],
  );

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

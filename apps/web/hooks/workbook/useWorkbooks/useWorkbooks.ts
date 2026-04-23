import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";

import { tsr } from "../../../lib/tsr";
import { useDebounce } from "../../useDebounce";

export type WorkbookFilter = "my" | "all";

export function useWorkbooks({
  initialFilter = "my",
  initialSearch = "",
}: {
  initialFilter?: WorkbookFilter;
  initialSearch?: string;
} = {}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const rawFilter = searchParams.get("filter");

  const [filter, setFilterState] = useState<WorkbookFilter>(
    rawFilter === "all" ? "all" : rawFilter === "my" ? "my" : initialFilter,
  );
  const [search, setSearch] = useState<string>(initialSearch);
  const [debouncedSearch] = useDebounce(search, 300);

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

  const setFilter = useCallback(
    (value: WorkbookFilter) => {
      setFilterState(value);
      const queryString = createQueryString("filter", value === "all" ? "all" : null);
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router, createQueryString],
  );

  const query = tsr.workbooks.listWorkbooks.useQuery({
    queryData: {
      query: {
        filter: filter === "all" ? undefined : "my",
        search: debouncedSearch && debouncedSearch.trim() !== "" ? debouncedSearch : undefined,
      },
    },
    queryKey: ["workbooks", filter, debouncedSearch],
  });

  // Auto-switch to "all" if user has no workbooks of their own on initial load
  const hasAutoSwitched = useRef(false);
  useEffect(() => {
    if (
      !hasAutoSwitched.current &&
      filter === "my" &&
      query.data?.body.length === 0 &&
      !debouncedSearch
    ) {
      hasAutoSwitched.current = true;
      setFilter("all");
    }
  }, [filter, query.data?.body, setFilter, debouncedSearch]);

  return {
    data: query.data?.body,
    isLoading: query.isLoading,
    error: query.error,
    filter,
    setFilter,
    search,
    setSearch,
  };
}

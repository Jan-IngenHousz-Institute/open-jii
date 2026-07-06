import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useState, useCallback } from "react";

import { tsr } from "../../../lib/tsr";
import { useDebounce } from "../../useDebounce";

export type WorkbookFilter = "accessible" | "public";

export function useWorkbooks({
  initialFilter = "accessible",
  initialSearch = "",
}: {
  initialFilter?: WorkbookFilter;
  initialSearch?: string;
} = {}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const rawScope = searchParams.get("scope");

  const [filter, setFilterState] = useState<WorkbookFilter>(
    rawScope === "public" ? "public" : initialFilter,
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
      const queryString = createQueryString("scope", value === "public" ? "public" : null);
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router, createQueryString],
  );

  const query = tsr.workbooks.listWorkbooks.useQuery({
    queryData: {
      query: {
        scope: filter === "public" ? "public" : undefined,
        search: debouncedSearch && debouncedSearch.trim() !== "" ? debouncedSearch : undefined,
      },
    },
    queryKey: ["workbooks", filter, debouncedSearch],
  });

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

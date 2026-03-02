import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useState, useCallback } from "react";

import type { MacroLanguage } from "@repo/api";

import { tsr } from "../../../lib/tsr";
import { useDebounce } from "../../useDebounce";

export type MacroFilter = "my" | "all";

export function useMacros({
  initialFilter = "my",
  initialSearch = "",
  initialLanguage,
}: {
  initialFilter?: MacroFilter;
  initialSearch?: string;
  initialLanguage?: MacroLanguage;
} = {}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const rawFilter = searchParams.get("filter");

  const [filter, setFilterState] = useState<MacroFilter>(
    rawFilter === "all" ? "all" : rawFilter === "my" ? "my" : initialFilter,
  );
  const [search, setSearch] = useState<string>(initialSearch);
  const [debouncedSearch] = useDebounce(search, 300);
  const [language, setLanguage] = useState<MacroLanguage | undefined>(initialLanguage);

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
    (value: MacroFilter) => {
      setFilterState(value);
      const queryString = createQueryString("filter", value === "all" ? "all" : null);
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router, createQueryString],
  );

  const query = tsr.macros.listMacros.useQuery({
    queryData: {
      query: {
        filter: filter === "all" ? undefined : "my",
        search: debouncedSearch && debouncedSearch.trim() !== "" ? debouncedSearch : undefined,
        language,
      },
    },
    queryKey: ["macros", filter, debouncedSearch, language],
  });

  return {
    data: query.data?.body,
    isLoading: query.isLoading,
    error: query.error,
    filter,
    setFilter,
    search,
    setSearch,
    language,
    setLanguage,
  };
}

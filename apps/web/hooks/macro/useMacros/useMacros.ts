import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useState, useCallback } from "react";

import type { MacroLanguage } from "@repo/api/schemas/macro.schema";

import { tsr } from "../../../lib/tsr";
import { useDebounce } from "../../useDebounce";

export type MacroFilter = "accessible" | "public";

export function useMacros({
  initialFilter = "accessible",
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

  const rawScope = searchParams.get("scope");

  const [filter, setFilterState] = useState<MacroFilter>(
    rawScope === "public" ? "public" : initialFilter,
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
      const queryString = createQueryString("scope", value === "public" ? "public" : null);
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router, createQueryString],
  );

  const query = tsr.macros.listMacros.useQuery({
    queryData: {
      query: {
        scope: filter === "public" ? "public" : undefined,
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

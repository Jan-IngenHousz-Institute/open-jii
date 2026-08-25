import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { MacroLanguage } from "@repo/api/domains/macro/macro.schema";
import { isPaginatedList } from "@repo/api/shared/listing";

import { useDebounce } from "../../useDebounce";

export function useMacros({
  initialSearch = "",
  initialLanguage,
}: {
  initialSearch?: string;
  initialLanguage?: MacroLanguage;
} = {}) {
  const [search, setSearchState] = useState<string>(initialSearch);
  const [debouncedSearch] = useDebounce(search, 300);
  const [language, setLanguageState] = useState<MacroLanguage | undefined>(initialLanguage);
  const [page, setPage] = useState(1);

  const setSearch = (value: string) => {
    setSearchState(value);
    setPage(1);
  };

  const setLanguage = (value: MacroLanguage | undefined) => {
    setLanguageState(value);
    setPage(1);
  };

  const query = useQuery(
    orpc.macros.listMacros.queryOptions({
      input: {
        search: debouncedSearch && debouncedSearch.trim() !== "" ? debouncedSearch : undefined,
        language,
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
    search,
    setSearch,
    language,
    setLanguage,
    page,
    setPage,
  };
}

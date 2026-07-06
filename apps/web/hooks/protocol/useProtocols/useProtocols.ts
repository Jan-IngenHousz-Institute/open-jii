import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useState, useCallback } from "react";

import { tsr } from "../../../lib/tsr";
import { useDebounce } from "../../useDebounce";

export type ProtocolFilter = "accessible" | "public";

export const useProtocols = ({
  initialFilter = "accessible",
  initialSearch = "",
}: {
  initialFilter?: ProtocolFilter;
  initialSearch?: string;
} = {}) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const rawScope = searchParams.get("scope");

  const [filter, setFilterState] = useState<ProtocolFilter>(
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
    (value: ProtocolFilter) => {
      setFilterState(value);
      const queryString = createQueryString("scope", value === "public" ? "public" : null);
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router, createQueryString],
  );

  const { data } = tsr.protocols.listProtocols.useQuery({
    queryData: {
      query: {
        scope: filter === "public" ? "public" : undefined,
        search: debouncedSearch && debouncedSearch.trim() !== "" ? debouncedSearch : undefined,
      },
    },
    queryKey: ["protocols", filter, debouncedSearch],
  });

  return {
    protocols: data?.body,
    filter,
    setFilter,
    search,
    setSearch,
  };
};

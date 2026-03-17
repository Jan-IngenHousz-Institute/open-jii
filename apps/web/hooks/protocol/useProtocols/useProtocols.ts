import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";

import { tsr } from "../../../lib/tsr";
import { useDebounce } from "../../useDebounce";

export type ProtocolFilter = "my" | "all";

export const useProtocols = ({
  initialFilter = "my",
  initialSearch = "",
}: {
  initialFilter?: ProtocolFilter;
  initialSearch?: string;
} = {}) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const rawFilter = searchParams.get("filter");

  const [filter, setFilterState] = useState<ProtocolFilter>(
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
    (value: ProtocolFilter) => {
      setFilterState(value);
      const queryString = createQueryString("filter", value === "all" ? "all" : null);
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router, createQueryString],
  );

  const { data } = tsr.protocols.listProtocols.useQuery({
    queryData: {
      query: {
        filter: filter === "all" ? undefined : "my",
        search: debouncedSearch && debouncedSearch.trim() !== "" ? debouncedSearch : undefined,
      },
    },
    queryKey: ["protocols", filter, debouncedSearch],
  });

  // Auto-switch to "all" if user has no protocols of their own on initial load
  const hasAutoSwitched = useRef(false);
  useEffect(() => {
    if (
      !hasAutoSwitched.current &&
      filter === "my" &&
      data?.body.length === 0 &&
      !debouncedSearch
    ) {
      hasAutoSwitched.current = true;
      setFilter("all");
    }
  }, [filter, data?.body, setFilter, debouncedSearch]);

  return {
    protocols: data?.body,
    filter,
    setFilter,
    search,
    setSearch,
  };
};

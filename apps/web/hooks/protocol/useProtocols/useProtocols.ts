import { useState } from "react";

import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch a list of protocols with optional search functionality
 * @param initialSearch Optional initial search term
 * @returns Query result containing the protocols list and search control
 */
export const useProtocols = ({ initialSearch = "" }: { initialSearch?: string } = {}) => {
  const [search, setSearch] = useState<string>(initialSearch);

  const { data, isLoading, error } = tsr.protocols.listProtocols.useQuery({
    queryData: {
      query: { search: search || undefined },
    },
    queryKey: ["protocols", search],
  });

  // Return query result with search control
  return {
    protocols: data?.body,
    isLoading,
    error,
    search,
    setSearch,
  };
};

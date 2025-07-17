import type { Protocol } from "@repo/api";

import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch a list of protocols with optional search functionality
 * @param search Search term (controlled externally)
 * @returns Query result containing the protocols list
 */

interface useProtocolSearchResult {
  protocols: Protocol[] | undefined;
  isLoading: boolean;
  error: unknown;
}

export const useProtocolSearch = (search = ""): useProtocolSearchResult => {
  const { data, isLoading, error } = tsr.protocols.listProtocols.useQuery({
    queryData: {
      query: { search: search || undefined },
    },
    queryKey: ["protocols", search],
  });

  return {
    protocols: data?.body,
    isLoading: isLoading,
    error,
  };
};

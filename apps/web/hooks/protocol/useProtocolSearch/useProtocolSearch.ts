import { useQuery } from "@tanstack/react-query";

import type { Protocol } from "@repo/api/domains/protocol/protocol.schema";

import { orpc } from "@/lib/orpc";

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
  const { data, isLoading, error } = useQuery(
    orpc.protocols.listProtocols.queryOptions({
      input: { search: search || undefined },
    }),
  );

  return {
    protocols: data,
    isLoading: isLoading,
    error,
  };
};

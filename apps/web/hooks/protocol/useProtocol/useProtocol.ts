import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";

import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch a single protocol by ID
 * @param protocolId The ID of the protocol to fetch
 * @returns Query result containing the protocol details
 */
export const useProtocol = (protocolId: string, enabled = true) => {
  return useQuery(
    orpc.protocols.getProtocol.queryOptions({
      input: { id: protocolId },
      retry: shouldRetryQuery,
      enabled: enabled && !!protocolId,
    }),
  );
};

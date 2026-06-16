import { shouldRetryQuery } from "@/util/query-retry";

import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch a single protocol by ID
 * @param protocolId The ID of the protocol to fetch
 * @returns Query result containing the protocol details
 */
export const useProtocol = (protocolId: string, enabled = true, version?: number) => {
  return tsr.protocols.getProtocol.useQuery({
    queryData: { params: { id: protocolId }, query: { version } },
    queryKey: version != null ? ["protocol", protocolId, version] : ["protocol", protocolId],
    retry: shouldRetryQuery,
    enabled: enabled && !!protocolId,
  });
};
